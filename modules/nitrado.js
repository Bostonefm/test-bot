const axios = require('axios');
const path = require('path');
const logger = require('../utils/logger.js');
const { NitradoAuth } = require('./nitradoAuth.js');
const { NitradoFiles } = require('./nitradoFiles.js');
const { NitradoConsole } = require('./nitradoConsole.js');

class NitradoAPI {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://api.nitrado.net';
    this.rateLimitQueue = new Map();

    // ✅ define executeWithBackoff FIRST so bind() is safe
    this.executeWithBackoff = this._createBackoffHandler();

    // ✅ now safely construct child modules
    this.auth = new NitradoAuth(this.baseURL);
    this.files = new NitradoFiles(token, this.baseURL, this.executeWithBackoff);
    this.console = new NitradoConsole(token, this.baseURL, this.executeWithBackoff);
  }

  /**
   * 🛡️ Creates a safe backoff wrapper to retry API requests
   */
  _createBackoffHandler() {
    return async (requestFn, endpoint = 'unknown', maxRetries = 3, baseDelay = 1000) => {
      let attempt = 0;
      while (attempt <= maxRetries) {
        try {
          return await requestFn();
        } catch (error) {
          const code = error.response?.status;
          const retryable = [429, 500, 502, 503, 504].includes(code);
          if (!retryable) throw error;

          attempt++;
          if (attempt > maxRetries) throw error;

          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
          logger.warn(
            `[NitradoAPI] ⚠️ Retry ${attempt}/${maxRetries} for ${endpoint} after ${delay}ms (${code})`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    };
  }

  // ============================================================
  // ✅ File Operations Bridge (connects NitradoAPI ↔ NitradoFiles)
  // ============================================================
  async listFiles(serviceId, path = '/', fetchAll = true) {
    if (!this.files || typeof this.files.listFiles !== 'function') {
      logger.error('[NitradoAPI] NitradoFiles not initialized properly.');
      throw new Error('NitradoFiles module not available');
    }

    try {
      return await this.files.listFiles(serviceId, path, fetchAll);
    } catch (err) {
      logger.error(`[NitradoAPI] listFiles(${path}) failed: ${err.message}`);
      throw err;
    }
  }

  async downloadFile(serviceId, filePath) {
    if (!this.files || typeof this.files.downloadFile !== 'function') {
      logger.error('[NitradoAPI] NitradoFiles not initialized properly.');
      throw new Error('NitradoFiles module not available');
    }

    try {
      return await this.files.downloadFile(serviceId, filePath);
    } catch (err) {
      logger.error(`[NitradoAPI] downloadFile(${filePath}) failed: ${err.message}`);
      throw err;
    }
  }

  // ============================================================
  // ✅ Everything below this line is unchanged from your version
  // ============================================================

  /**
   * Get specific service details
   */
  async getService(serviceId) {
    return await this.nitradoRequest('GET', `/services/${serviceId}`);
  }

  /**
   * ✅ Unified getServiceInfo() alias
   */
  async getServiceInfo(serviceId) {
    try {
      const response = await this.getService(serviceId);
      const service =
        response.data?.data?.service ||
        response.data?.service ||
        response.data ||
        null;

      if (!service) throw new Error('Invalid Nitrado API response (no service data)');

      return {
        id: service.id,
        status: service.status || 'unknown',
        type: service.type || 'unknown',
        details: service.details || {},
        raw: service,
      };
    } catch (error) {
      logger.error(`[NitradoAPI] getServiceInfo(${serviceId}) failed: ${error.message}`);
      return { status: 'unknown', error: error.message };
    }
  }

  /**
   * Get gameserver details
   */
  async getGameserver(serviceId) {
    return await this.nitradoRequest('GET', `/services/${serviceId}/gameservers`);
  }

  /**
   * Core request handler (used by other modules)
   */
  async nitradoRequest(method, endpoint, options = {}, rateLimitKey = null) {
    const { params, data, headers = {}, responseType = 'json', timeout = 30000 } = options;
    const rateLimitEndpoint = rateLimitKey || endpoint.split('?')[0];

    const config = {
      method: method.toUpperCase(),
      url: endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GrizzlyBot/1.0',
        ...headers,
      },
      timeout,
      responseType,
    };

    if (params) config.params = params;
    if (data) config.data = data;

    return await this.executeWithBackoff(() => axios(config), rateLimitEndpoint)
      .then((response) => {
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return responseType === 'json' ? response.data : response;
      })
      .catch((error) => {
        let message = 'Unknown error occurred';
        let status = error.response?.status || null;

        if (error.response) {
          message =
            error.response.data?.message ||
            error.response.data?.error ||
            error.response.statusText ||
            `HTTP ${status} Error`;
        } else if (error.request) {
          message = 'Network error - no response received';
        } else {
          message = error.message;
        }

        logger.error(`Nitrado API Request Failed: ${method.toUpperCase()} ${endpoint}`, {
          status,
          message,
          endpoint: rateLimitEndpoint,
        });

        const err = new Error(message);
        err.status = status;
        err.endpoint = endpoint;
        err.originalError = error;
        throw err;
      });
  }
}

// === safe factory function ===
function createNitradoAPI(token) {
  if (!token) throw new Error('Nitrado API token is required');
  return new NitradoAPI(token);
}

async function getNitradoToken(guildId, discordUserId, serviceId) {
  const { NitradoAuthManager } = require('./nitradoAuth.js');
  const authManager = new NitradoAuthManager();
  try {
    return await authManager.getToken(guildId, discordUserId, serviceId);
  } catch (error) {
    logger.error(`Failed to get Nitrado token: ${error.message}`);
    throw error;
  }
}

async function storeNitradoToken(guildId, discordUserId, serviceId, token, permissionLevel = 1) {
  const { NitradoAuthManager } = require('./nitradoAuth.js');
  const authManager = new NitradoAuthManager();
  try {
    return await authManager.storeToken(guildId, discordUserId, serviceId, token, permissionLevel);
  } catch (error) {
    logger.error(`Failed to store Nitrado token: ${error.message}`);
    throw error;
  }
}

async function checkNitradoPermission(guildId, discordUserId, serviceId, requiredLevel) {
  const { NitradoAuthManager } = require('./nitradoAuth.js');
  const authManager = new NitradoAuthManager();
  try {
    return await authManager.hasPermission(guildId, discordUserId, serviceId, requiredLevel);
  } catch (error) {
    logger.error(`Failed to check Nitrado permission: ${error.message}`);
    return false;
  }
}

module.exports = {
  NitradoAPI,
  createNitradoAPI,
  getNitradoToken,
  storeNitradoToken,
  checkNitradoPermission,
};
