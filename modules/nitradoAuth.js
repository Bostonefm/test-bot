const axios = require('axios');
const { encrypt, decrypt } = require('../utils/encryption.js');
const { db } = require('./db.js');
const logger = require('../utils/logger.js');

/**
 * @typedef {Object} OAuthState
 * @property {string} guildId - Discord guild ID
 * @property {string} discordUserId - Discord user ID
 * @property {string|null} returnUrl - Return URL after auth
 * @property {number} timestamp - State creation timestamp
 * @property {string} nonce - Random nonce for security
 */

/**
 * @typedef {Object} TokenData
 * @property {string} access_token - OAuth access token
 * @property {string} refresh_token - OAuth refresh token
 * @property {number} expires_in - Token expiration time in seconds
 * @property {string} scope - Token scopes
 */

/**
 * Nitrado OAuth2 and Permissions Manager
 * Handles authentication, authorization, and token management
 */
class NitradoAuthManager {
  constructor() {
    this.nitradoOAuthURL = 'https://oauth.nitrado.net';
    this.nitradoAPIURL = 'https://api.nitrado.net';

    // Permission levels
    this.PERMISSION_LEVELS = {
      NONE: 0,
      VIEWER: 1, // Can view status, logs, players
      OPERATOR: 2, // Can restart, send commands
      ADMIN: 3, // Can modify settings, upload files
      OWNER: 4, // Full access including token management
    };
  }

  /**
   * Generate OAuth2 authorization URL for Nitrado (standards-compliant)
   */
  generateAuthURL(guildId, discordUserId, returnUrl = null) {
    const state = this.generateState(guildId, discordUserId, returnUrl);
    const scopes = [
      'user_info',
      'service',
      'service_general',
      'service_gameserver',
      'service_gameserver_file',
    ].join(' ');

    const authURL =
      `${this.nitradoOAuthURL}/oauth/v2/auth?` +
      `response_type=code&` +
      `client_id=${process.env.NITRADO_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.NITRADO_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state}`;

    return {
      authURL,
      state: state,
    };
  }

  /**
   * Generate secure state parameter for OAuth2
   */
  generateState(guildId, discordUserId, returnUrl = null) {
    const stateData = {
      guildId,
      discordUserId,
      returnUrl,
      timestamp: Date.now(),
      nonce: require('crypto').randomBytes(16).toString('hex'),
    };

    return Buffer.from(JSON.stringify(stateData)).toString('base64');
  }

  /**
   * Validate and decode OAuth2 state parameter
   */
  validateState(state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());

      // Check if state is not older than 10 minutes
      if (Date.now() - decoded.timestamp > 10 * 60 * 1000) {
        throw new Error('State parameter expired');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid state parameter');
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, state) {
    try {
      const stateData = this.validateState(state);

      const response = await axios.post(
        `${this.nitradoOAuthURL}/oauth/v2/token`,
        {
          grant_type: 'authorization_code',
          client_id: process.env.NITRADO_CLIENT_ID,
          client_secret: process.env.NITRADO_CLIENT_SECRET,
          code: code,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const tokenData = response.data;

      // Store the token with refresh token
      await this.storeOAuthToken(
        stateData.guildId,
        stateData.discordUserId,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_in,
        tokenData.scope
      );

      return {
        success: true,
        tokenData,
        stateData,
      };
    } catch (error) {
      logger.error(`OAuth2 token exchange failed: ${error.message}`);
      throw new Error(`Failed to exchange code for token: ${error.message}`);
    }
  }

  /**
   * Refresh an expired access token
   */
  async refreshToken(guildId, discordUserId, serviceId) {
    try {
      const refreshTokenData = await this.getRefreshToken(guildId, discordUserId, serviceId);

      const response = await axios.post(
        `${this.nitradoOAuthURL}/oauth/v2/token`,
        {
          grant_type: 'refresh_token',
          client_id: process.env.NITRADO_CLIENT_ID,
          refresh_token: refreshTokenData,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const tokenData = response.data;

      // Update stored token
      await this.storeOAuthToken(
        guildId,
        discordUserId,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_in,
        tokenData.scope
      );

      return tokenData.access_token;
    } catch (error) {
      logger.error(`Token refresh failed: ${error.message}`);
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  /**
   * Store Nitrado token with permissions
   */
  async storeToken(
    guildId,
    discordUserId,
    serviceId,
    token,
    permissionLevel = this.PERMISSION_LEVELS.VIEWER
  ) {
    try {
      // Validate token by testing it
      const isValid = await this.validateToken(token);
      if (!isValid) {
        throw new Error('Invalid Nitrado token');
      }

      // Encrypt token
      const encryptedData = encrypt(token);

      // Check if user already has a token for this service
      const existing = await db.query(
        'SELECT discord_id FROM nitrado_credentials WHERE discord_id = $1 AND guild_id = $2 AND service_id = $3',
        [discordUserId, guildId, serviceId]
      );

      if (existing.rows.length > 0) {
        // Update existing token
        await db.query(
          `
          UPDATE nitrado_credentials 
          SET encrypted_token = $1, token_iv = $2, auth_tag = $3, updated_at = NOW()
          WHERE discord_id = $4 AND guild_id = $5 AND service_id = $6
        `,
          [
            encryptedData.ciphertext,
            encryptedData.iv,
            encryptedData.tag,
            discordUserId,
            guildId,
            serviceId,
          ]
        );
      } else {
        // Insert new token
        await db.query(
          `
          INSERT INTO nitrado_credentials (discord_id, guild_id, service_id, encrypted_token, token_iv, auth_tag, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
          [
            discordUserId,
            guildId,
            serviceId,
            encryptedData.ciphertext,
            encryptedData.iv,
            encryptedData.tag,
          ]
        );
      }

      // Set user permissions
      await this.setUserPermissions(guildId, discordUserId, serviceId, permissionLevel);

      logger.info(
        `Stored Nitrado token for user ${discordUserId} in guild ${guildId} for service ${serviceId}`
      );
      return true;
    } catch (error) {
      logger.error(`Failed to store Nitrado token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get decrypted token for user and service
   */
  async getToken(guildId, discordUserId, serviceId) {
    try {
      const result = await db.query(
        `
        SELECT encrypted_token, token_iv, auth_tag 
        FROM nitrado_credentials 
        WHERE discord_id = $1 AND guild_id = $2 AND service_id = $3
      `,
        [discordUserId, guildId, serviceId]
      );

      if (result.rows.length === 0) {
        // Try to get guild-wide token if user doesn't have specific one
        const guildResult = await db.query(
          `
          SELECT encrypted_token, token_iv, auth_tag 
          FROM nitrado_credentials 
          WHERE guild_id = $1 AND service_id = $2
          ORDER BY updated_at DESC LIMIT 1
        `,
          [guildId, serviceId]
        );

        if (guildResult.rows.length === 0) {
          throw new Error('No Nitrado token found');
        }

        const { encrypted_token, token_iv, auth_tag } = guildResult.rows[0];
        return decrypt(encrypted_token, token_iv, auth_tag);
      }

      const { encrypted_token, token_iv, auth_tag } = result.rows[0];
      return decrypt(encrypted_token, token_iv, auth_tag);
    } catch (error) {
      logger.error(`Failed to get Nitrado token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set user permissions for a service
   */
  async setUserPermissions(guildId, discordUserId, serviceId, permissionLevel) {
    try {
      await db.query(
        `
        INSERT INTO nitrado_permissions (guild_id, discord_id, service_id, permission_level, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (guild_id, discord_id, service_id) 
        DO UPDATE SET permission_level = $4, updated_at = NOW()
      `,
        [guildId, discordUserId, serviceId, permissionLevel]
      );

      logger.info(
        `Set permission level ${permissionLevel} for user ${discordUserId} in guild ${guildId} for service ${serviceId}`
      );
    } catch (error) {
      logger.error(`Failed to set permissions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user permission level for a service
   */
  async getUserPermissions(guildId, discordUserId, serviceId) {
    try {
      const result = await db.query(
        `
        SELECT permission_level 
        FROM nitrado_permissions 
        WHERE guild_id = $1 AND discord_id = $2 AND service_id = $3
      `,
        [guildId, discordUserId, serviceId]
      );

      if (result.rows.length === 0) {
        return this.PERMISSION_LEVELS.NONE;
      }

      return result.rows[0].permission_level;
    } catch (error) {
      logger.error(`Failed to get user permissions: ${error.message}`);
      return this.PERMISSION_LEVELS.NONE;
    }
  }

  /**
   * Check if user has required permission for an action
   */
  async hasPermission(guildId, discordUserId, serviceId, requiredLevel) {
    const userLevel = await this.getUserPermissions(guildId, discordUserId, serviceId);
    return userLevel >= requiredLevel;
  }

  /**
   * Validate Nitrado token
   */
  async validateToken(token) {
    try {
      const response = await axios.get(`${this.nitradoAPIURL}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'GrizzlyBot/1.0',
        },
        timeout: 10000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke user access to a service
   */
  async revokeAccess(guildId, discordUserId, serviceId) {
    try {
      await db.query('BEGIN');

      // Remove token
      await db.query(
        `
        DELETE FROM nitrado_credentials 
        WHERE discord_id = $1 AND guild_id = $2 AND service_id = $3
      `,
        [discordUserId, guildId, serviceId]
      );

      // Remove permissions
      await db.query(
        `
        DELETE FROM nitrado_permissions 
        WHERE guild_id = $1 AND discord_id = $2 AND service_id = $3
      `,
        [guildId, discordUserId, serviceId]
      );

      await db.query('COMMIT');

      logger.info(
        `Revoked access for user ${discordUserId} in guild ${guildId} for service ${serviceId}`
      );
      return true;
    } catch (error) {
      await db.query('ROLLBACK');
      logger.error(`Failed to revoke access: ${error.message}`);
      throw error;
    }
  }

  /**
   * List users with access to a service
   */
  async getServiceUsers(guildId, serviceId) {
    try {
      const result = await db.query(
        `
        SELECT DISTINCT nc.discord_id, np.permission_level, nc.updated_at
        FROM nitrado_credentials nc
        LEFT JOIN nitrado_permissions np ON nc.discord_id = np.discord_id 
          AND nc.guild_id = np.guild_id AND nc.service_id = np.service_id
        WHERE nc.guild_id = $1 AND nc.service_id = $2
        ORDER BY np.permission_level DESC, nc.updated_at DESC
      `,
        [guildId, serviceId]
      );

      return result.rows;
    } catch (error) {
      logger.error(`Failed to get service users: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a sub-token with limited scope/lifetime
   */
  async createSubToken(parentToken, options = {}) {
    try {
      const params = {};

      if (options.scope) {
        params.scope = options.scope;
      }
      if (options.expires_in) {
        params.expires_in = options.expires_in;
      }
      if (options.service_id) {
        params.service_id = options.service_id;
      }
      if (options.user_id) {
        params.user_id = options.user_id;
      }

      const response = await axios.post('https://oauth.nitrado.net/token/sub', params, {
        headers: {
          Authorization: `Bearer ${parentToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data.data.token;
    } catch (error) {
      logger.error(`Sub-token creation failed: ${error.message}`);
      throw new Error(`Failed to create sub-token: ${error.message}`);
    }
  }

  /**
   * Create a long-life token for automation
   */
  async createLongLifeToken(updateToken, clientId, clientSecret, description, options = {}) {
    try {
      const params = {
        token: updateToken,
        client_id: clientId,
        client_secret: clientSecret,
        description: description,
      };

      if (options.scope) {
        params.scope = options.scope;
      }
      if (options.service_id) {
        params.service_id = options.service_id;
      }

      const response = await axios.post('https://oauth.nitrado.net/token/long_life_token', params, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data.data.token;
    } catch (error) {
      logger.error(`Long-life token creation failed: ${error.message}`);
      throw new Error(`Failed to create long-life token: ${error.message}`);
    }
  }

  /**
   * List all long-life tokens
   */
  async listLongLifeTokens(accessToken) {
    try {
      const response = await axios.get('https://oauth.nitrado.net/token/long_life_token', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.data.tokens;
    } catch (error) {
      logger.error(`Failed to list long-life tokens: ${error.message}`);
      throw new Error(`Failed to list long-life tokens: ${error.message}`);
    }
  }

  /**
   * Delete a long-life token
   */
  async deleteLongLifeToken(accessToken, tokenId) {
    try {
      const response = await axios.delete(
        `https://oauth.nitrado.net/token/long_life_token/${tokenId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data.message;
    } catch (error) {
      logger.error(`Failed to delete long-life token: ${error.message}`);
      throw new Error(`Failed to delete long-life token: ${error.message}`);
    }
  }

  /**
   * Get token info/identity
   */
  async getTokenInfo(accessToken) {
    try {
      const response = await axios.get('https://oauth.nitrado.net/token', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.data.token;
    } catch (error) {
      logger.error(`Failed to get token info: ${error.message}`);
      throw new Error(`Failed to get token info: ${error.message}`);
    }
  }

  /**
   * Expire/invalidate a token
   */
  async expireToken(accessToken) {
    try {
      await axios.delete('https://oauth.nitrado.net/oauth/v2/token', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return true;
    } catch (error) {
      logger.error(`Failed to expire token: ${error.message}`);
      throw new Error(`Failed to expire token: ${error.message}`);
    }
  }

  /**
   * Store OAuth token with refresh token
   */
  async storeOAuthToken(guildId, discordUserId, accessToken, refreshToken, expiresIn, scope) {
    try {
      const encryptedAccess = encrypt(accessToken);
      const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      await db.query(
        `
        INSERT INTO nitrado_oauth_tokens (
          guild_id, discord_id, encrypted_access_token, access_token_iv, access_token_auth_tag,
          encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag,
          expires_at, scope, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (guild_id, discord_id) 
        DO UPDATE SET 
          encrypted_access_token = $3, access_token_iv = $4, access_token_auth_tag = $5,
          encrypted_refresh_token = $6, refresh_token_iv = $7, refresh_token_auth_tag = $8,
          expires_at = $9, scope = $10, updated_at = NOW()
      `,
        [
          guildId,
          discordUserId,
          encryptedAccess.ciphertext,
          encryptedAccess.iv,
          encryptedAccess.tag,
          encryptedRefresh?.ciphertext,
          encryptedRefresh?.iv,
          encryptedRefresh?.tag,
          expiresAt,
          scope,
        ]
      );

      logger.info(`Stored OAuth token for user ${discordUserId} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to store OAuth token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get refresh token for user
   */
  async getRefreshToken(guildId, discordUserId, serviceId) {
    try {
      const result = await db.query(
        `
        SELECT encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag 
        FROM nitrado_oauth_tokens 
        WHERE guild_id = $1 AND discord_id = $2
      `,
        [guildId, discordUserId]
      );

      if (result.rows.length === 0) {
        throw new Error('No refresh token found');
      }

      const { encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag } = result.rows[0];
      return decrypt(encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag);
    } catch (error) {
      logger.error(`Failed to get refresh token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get permission level name
   */
  getPermissionName(level) {
    const names = {
      [this.PERMISSION_LEVELS.NONE]: 'None',
      [this.PERMISSION_LEVELS.VIEWER]: 'Viewer',
      [this.PERMISSION_LEVELS.OPERATOR]: 'Operator',
      [this.PERMISSION_LEVELS.ADMIN]: 'Admin',
      [this.PERMISSION_LEVELS.OWNER]: 'Owner',
    };
    return names[level] || 'Unknown';
  }
}

module.exports = { NitradoAuthManager };

/**
 * Nitrado Authentication Module
 * Handles OAuth2, token management, and authentication-related operations
 */
class NitradoAuth {
  constructor(baseURL = 'https://api.nitrado.net') {
    this.baseURL = baseURL;
    this.oauthURL = 'https://oauth.nitrado.net';
  }

  /**
   * Validate Nitrado token by testing API access
   */
  async validateToken(token) {
    try {
      const response = await axios.get(`${this.baseURL}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'GrizzlyBot/1.0',
        },
        timeout: 10000,
      });
      return response.status === 200;
    } catch (error) {
      logger.error(`Token validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get user information using token
   */
  async getUserInfo(token) {
    try {
      const response = await axios.get(`${this.baseURL}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'GrizzlyBot/1.0',
        },
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Generate OAuth2 authorization URL
   */
  generateAuthURL(clientId, redirectUri, scopes = [], state = null) {
    const scopeString = Array.isArray(scopes) ? scopes.join(' ') : scopes;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopeString,
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.oauthURL}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
    try {
      const response = await axios.post(
        `${this.oauthURL}/oauth/v2/token`,
        {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken, clientId, clientSecret) {
    try {
      const response = await axios.post(
        `${this.oauthURL}/oauth/v2/token`,
        {
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Create a sub-token with limited scope/lifetime
   */
  async createSubToken(parentToken, options = {}) {
    try {
      const params = {};

      if (options.scope) {
        params.scope = options.scope;
      }
      if (options.expires_in) {
        params.expires_in = options.expires_in;
      }
      if (options.service_id) {
        params.service_id = options.service_id;
      }
      if (options.user_id) {
        params.user_id = options.user_id;
      }

      const response = await axios.post(`${this.oauthURL}/token/sub`, params, {
        headers: {
          Authorization: `Bearer ${parentToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data.data.token;
    } catch (error) {
      throw new Error(`Sub-token creation failed: ${error.message}`);
    }
  }

  /**
   * Create a long-life token for automation
   */
  async createLongLifeToken(updateToken, clientId, clientSecret, description, options = {}) {
    try {
      const params = {
        token: updateToken,
        client_id: clientId,
        client_secret: clientSecret,
        description: description,
      };

      if (options.scope) {
        params.scope = options.scope;
      }
      if (options.service_id) {
        params.service_id = options.service_id;
      }

      const response = await axios.post(`${this.oauthURL}/token/long_life_token`, params, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data.data.token;
    } catch (error) {
      throw new Error(`Long-life token creation failed: ${error.message}`);
    }
  }

  /**
   * List all long-life tokens
   */
  async listLongLifeTokens(accessToken) {
    try {
      const response = await axios.get(`${this.oauthURL}/token/long_life_token`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.data.tokens;
    } catch (error) {
      throw new Error(`Failed to list long-life tokens: ${error.message}`);
    }
  }

  /**
   * Delete a long-life token
   */
  async deleteLongLifeToken(accessToken, tokenId) {
    try {
      const response = await axios.delete(`${this.oauthURL}/token/long_life_token/${tokenId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.message;
    } catch (error) {
      throw new Error(`Failed to delete long-life token: ${error.message}`);
    }
  }

  /**
   * Get token info/identity
   */
  async getTokenInfo(accessToken) {
    try {
      const response = await axios.get(`${this.oauthURL}/token`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.data.token;
    } catch (error) {
      throw new Error(`Failed to get token info: ${error.message}`);
    }
  }

  /**
   * Expire/invalidate a token
   */
  async expireToken(accessToken) {
    try {
      await axios.delete(`${this.oauthURL}/oauth/v2/token`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to expire token: ${error.message}`);
    }
  }

  /**
   * Test API connection with token
   */
  async testConnection(token) {
    try {
      const userInfo = await this.getUserInfo(token);
      return {
        success: true,
        user: userInfo.data?.user || userInfo.user,
        message: 'API connection successful',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'API connection failed',
      };
    }
  }
}

module.exports.NitradoAuth = NitradoAuth;
