'use strict';
/**
 * ============================================================
 * 📡 Grizzly Bot — Nitrado Polling Monitor (Safe Version)
 * ============================================================
 */

const loggerBase = require('../utils/logger.js');
const logger = loggerBase.tag?.('NitradoPollingMonitor') ?? loggerBase;

const { getPool } = require('../utils/db.js');
const { createNitradoAPI } = require('./nitrado.js');
const { decrypt } = require('../utils/encryption.js');

class NitradoPollingMonitor {
  constructor(client, options = {}) {
    this.client = client;
    this.interval = options.interval || 5 * 60 * 1000; // 5 minutes
    this.timer = null;
    this.running = false;
    this.pool = null;
  }

  /**
   * Start polling
   */
  async startMonitoring(serviceId = null, token = null, guildId = null) {
    if (this.running) {
      logger.info('[NitradoPollingMonitor] 📡 Already running.');
      return;
    }

    this.running = true;
    logger.info('[NitradoPollingMonitor] 📡 Starting Nitrado Polling Monitor...');

    try {
      this.pool = await getPool();
    } catch (err) {
      logger.error('[NitradoPollingMonitor] ❌ DB connection failed:', err.message);
      return;
    }

    const tick = async () => {
      try {
        // SINGLE SERVICE MODE
        if (serviceId && token) {
          await this._pollService(serviceId, token, guildId);
          return;
        }

        // MULTI-GUILD MODE
        const { rows } = await this.pool.query(`
          SELECT guild_id, service_id, encrypted_token, token_iv, auth_tag
          FROM nitrado_credentials
          WHERE active = TRUE
        `);

        if (!rows.length) {
          logger.warn('[NitradoPollingMonitor] ⚠️ No Nitrado credentials found.');
          return;
        }

        for (const row of rows) {
          try {
            const token = decrypt(row.encrypted_token, row.token_iv, row.auth_tag);
            await this._pollService(row.service_id, token, row.guild_id);
          } catch (err) {
            logger.warn(`[NitradoPollingMonitor] ⚠️ Poll fail (${row.service_id}): ${err.message}`);
          }
        }
      } catch (err) {
        logger.error(`[NitradoPollingMonitor] ❌ Polling cycle error: ${err.message}`);
      }
    };

    // FIRST RUN
    await tick().catch(err => logger.error('[NitradoPollingMonitor] Initial tick failed:', err.message));

    // INTERVAL
    this.timer = setInterval(() => tick(), this.interval);
  }


  /**
   * Poll a single service
   */
  async _pollService(serviceId, token, guildId) {
    let api;

    try {
      api = createNitradoAPI(token);
    } catch (err) {
      logger.error(`[NitradoPollingMonitor] ❌ Failed to create Nitrado API: ${err.message}`);
      return;
    }

    let info;
    try {
      info = await api.getServiceInfo(serviceId);
    } catch (err) {
      logger.error(`[NitradoPollingMonitor] ❌ Could not fetch service info: ${err.message}`);
      return;
    }

    let status = info?.status || 'unknown';
    status = String(status).toLowerCase();

    // THESE STATES ARE HEALTHY
    const healthyStates = ['active', 'running', 'success', 'ok', 'online'];

    if (healthyStates.includes(status)) {
      logger.debug(`[NitradoPollingMonitor] ✅ Service ${serviceId} healthy (${status})`);
      return;
    }

    // ONLY SEND ALERT IF UNHEALTHY
    logger.warn(`[NitradoPollingMonitor] ⚠️ Service ${serviceId} is ${status}`);
    await this._notifyGuild(guildId, status);
  }


  /**
   * Notify guild
   */
  async _notifyGuild(guildId, status) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    const adminChannel =
      guild.channels.cache.find(c => c.name.includes('admin')) ||
      guild.systemChannel ||
      guild.channels.cache.find(c => c.type === 0);

    if (!adminChannel) return;

    await adminChannel.send({
      embeds: [
        {
          color: 0xff9800,
          title: '⚠️ Nitrado Service Alert',
          description: `Your Nitrado service is currently **${status.toUpperCase()}**.`,
          footer: { text: 'Grizzly Bot - Nitrado Polling Monitor' },
          timestamp: new Date().toISOString()
        }
      ]
    });
  }

  /**
   * Stop monitor
   */
  stopMonitoring() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;

    logger.info('[NitradoPollingMonitor] 🧹 Polling stopped.');
  }
}

module.exports = NitradoPollingMonitor;
