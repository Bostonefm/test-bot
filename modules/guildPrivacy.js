
const logger = require('../utils/logger.js');

class GuildPrivacyManager {
  constructor(pool) {
    this.pool = pool;
    this.guildDataCache = new Map();
    this.accessControlCache = new Map();
  }

  async initialize() {
    try {
      await this.pool.query('SELECT 1');
      logger.info('Guild privacy manager initialized');
      return true;
    } catch (error) {
      logger.error(`Guild privacy manager initialization failed: ${error.message}`);
      throw error;
    }
  }

  // Verify guild has active subscription
  async verifyGuildAccess(guildId) {
    try {
      const result = await this.pool.query(
        `SELECT subscription_tier, auto_setup_completed, nitrado_connected 
         FROM guild_subscriptions 
         WHERE guild_id = $1 AND subscription_tier != 'free'`,
        [guildId]
      );

      if (result.rows.length === 0) {
        return { hasAccess: false, reason: 'No active subscription' };
      }

      const guild = result.rows[0];
      return {
        hasAccess: true,
        tier: guild.subscription_tier,
        setupCompleted: guild.auto_setup_completed,
        nitradoConnected: guild.nitrado_connected
      };
    } catch (error) {
      logger.error(`Error verifying guild access: ${error.message}`);
      return { hasAccess: false, reason: 'Database error' };
    }
  }

  // Ensure data is isolated by guild
  async filterDataByGuild(data, guildId) {
    if (!Array.isArray(data)) {
      return data.guildId === guildId ? data : null;
    }

    return data.filter(item => item.guildId === guildId);
  }

  // Check if user has permission to access guild data
  async verifyUserGuildPermission(userId, guildId, client) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return false;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return false;

      // Check if user has admin or moderator role
      const hasPermission = member.permissions.has('Administrator') ||
                           member.roles.cache.some(role => 
                             ['Admin', 'Moderator'].includes(role.name)
                           );

      return hasPermission;
    } catch (error) {
      logger.error(`Error verifying user guild permission: ${error.message}`);
      return false;
    }
  }

  // Sanitize data for cross-guild sharing (remove sensitive info)
  sanitizeForSharing(data) {
    if (!data) return null;

    const sanitized = { ...data };
    delete sanitized.guildId;
    delete sanitized.serviceId;
    delete sanitized.serverDetails;
    delete sanitized.playerDetails;
    
    return sanitized;
  }

  // Log access attempts for security monitoring
  async logAccess(guildId, userId, action, success) {
    try {
      await this.pool.query(
        `INSERT INTO guild_access_logs (guild_id, user_id, action, success, timestamp)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [guildId, userId, action, success]
      );
    } catch (error) {
      logger.error(`Error logging access: ${error.message}`);
    }
  }

  // Rate limiting for API access
  checkRateLimit(guildId, action) {
    const key = `${guildId}:${action}`;
    const now = Date.now();
    const limit = this.accessControlCache.get(key) || { count: 0, resetTime: now + 60000 };

    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + 60000;
    }

    limit.count++;
    this.accessControlCache.set(key, limit);

    // Different limits based on subscription tier
    const maxRequests = 100; // Can be adjusted based on tier
    return limit.count <= maxRequests;
  }

  // Encrypt sensitive data before storage
  async encryptSensitiveData(data, guildId) {
    // This would integrate with your existing encryption utils
    const crypto = require('crypto');
    const { ENCRYPTION_KEY } = process.env;
    
    if (!ENCRYPTION_KEY) {
      throw new Error('Encryption key not configured');
    }

    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY + guildId);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }

  // Decrypt sensitive data for authorized access
  async decryptSensitiveData(encryptedData, guildId) {
    const crypto = require('crypto');
    const { ENCRYPTION_KEY } = process.env;
    
    if (!ENCRYPTION_KEY) {
      throw new Error('Encryption key not configured');
    }

    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY + guildId);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}

module.exports = GuildPrivacyManager;
