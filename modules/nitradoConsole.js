const axios = require('axios');
const logger = require('../utils/logger.js');

/**
 * 🧩 Nitrado Console Operations
 * Handles live server commands, stats, and session actions safely.
 */
class NitradoConsole {
  /**
   * @param {string} token - Nitrado API token
   * @param {string} [baseURL='https://api.nitrado.net'] - API base URL
   * @param {Function} [executeWithBackoff] - Optional rate limit backoff handler
   */
  constructor(token, baseURL = 'https://api.nitrado.net', executeWithBackoff) {
    this.token = token;
    this.baseURL = baseURL;

    // ✅ Defensive binding of fallback
    this.executeWithBackoff =
      typeof executeWithBackoff === 'function'
        ? executeWithBackoff.bind?.(this) || executeWithBackoff
        : async (fn) => {
            try {
              return await fn();
            } catch (err) {
              logger.error('⚠️ [NitradoConsole] Request failed without rate limiter:', err.message);
              throw err;
            }
          };
  }

  /**
   * Centralized console API request
   */
  async consoleRequest(method, endpoint, options = {}, rateLimitKey = null) {
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
        let errorMessage = 'Unknown error occurred';
        let statusCode = null;

        if (error.response) {
          statusCode = error.response.status;
          errorMessage =
            error.response.data?.message ||
            error.response.data?.error ||
            error.response.statusText ||
            `HTTP ${statusCode} Error`;
        } else if (error.request) {
          errorMessage = 'Network error - no response received';
        } else {
          errorMessage = error.message;
        }

        logger.error(`Nitrado Console Request Failed: ${method.toUpperCase()} ${endpoint}`, {
          status: statusCode,
          message: errorMessage,
          endpoint: rateLimitEndpoint,
        });

        const normalizedError = new Error(errorMessage);
        normalizedError.status = statusCode;
        normalizedError.endpoint = endpoint;
        normalizedError.originalError = error;
        throw normalizedError;
      });
  }

  /**
   * 🖥️ Get current gameserver status
   */
  async getGameserverStatus(serviceId) {
    return await this.consoleRequest(
      'GET',
      `/services/${serviceId}/gameservers`,
      {},
      `status-${serviceId}`
    );
  }

  /**
   * ▶️ Start server
   */
  async startGameserver(serviceId) {
    return await this.consoleRequest(
      'POST',
      `/services/${serviceId}/gameservers/start`,
      {},
      `start-${serviceId}`
    );
  }

  /**
   * ⏹️ Stop server
   */
  async stopGameserver(serviceId) {
    return await this.consoleRequest(
      'POST',
      `/services/${serviceId}/gameservers/stop`,
      {},
      `stop-${serviceId}`
    );
  }

  /**
   * 🔁 Restart server
   */
  async restartGameserver(serviceId) {
    return await this.consoleRequest(
      'POST',
      `/services/${serviceId}/gameservers/restart`,
      {},
      `restart-${serviceId}`
    );
  }

  /**
   * 🧍 Get player list
   */
  async getPlayers(serviceId) {
    return await this.consoleRequest(
      'GET',
      `/services/${serviceId}/gameservers/games/players`,
      {},
      `players-${serviceId}`
    );
  }

  /**
   * 🪵 Fetch logs for the last X hours
   */
  async getLogs(serviceId, hours = 24) {
    return await this.consoleRequest(
      'GET',
      `/services/${serviceId}/gameservers/logs`,
      { params: { hours } },
      `logs-${serviceId}`
    );
  }

  /**
   * 💬 Send command to gameserver console
   */
  async sendCommand(serviceId, command) {
    if (!command || typeof command !== 'string') throw new Error('Command must be a non-empty string');
    return await this.consoleRequest(
      'POST',
      `/services/${serviceId}/gameservers/console/execute`,
      { data: { command } },
      `cmd-${serviceId}`
    );
  }

  /**
   * 📊 Get server statistics
   */
  async getServerStats(serviceId) {
    return await this.consoleRequest(
      'GET',
      `/services/${serviceId}/gameservers/stats`,
      {},
      `stats-${serviceId}`
    );
  }

  /**
   * ⚙️ Get live data (CPU, RAM, etc.)
   */
  async getLiveData(serviceId) {
    return await this.consoleRequest(
      'GET',
      `/services/${serviceId}/gameservers/live_stats`,
      {},
      `live-${serviceId}`
    );
  }

  /**
   * 🌐 Get query info
   */
  async getQueryInfo(serviceId) {
    return await this.consoleRequest(
      'GET',
      `/services/${serviceId}/gameservers/query`,
      {},
      `query-${serviceId}`
    );
  }
}

module.exports = { NitradoConsole };
