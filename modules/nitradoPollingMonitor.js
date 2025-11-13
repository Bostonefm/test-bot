'use strict';
/**
 * ============================================================
 * 📡 Grizzly Bot — Nitrado Polling Monitor (Safe Version)
 * Monitors Nitrado services every few minutes for status changes
 * Compatible with "new NitradoPollingMonitor(client)"
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
   * Start monitoring all active Nitrado services in the database
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
      logger.error('[NitradoPollingMonitor] ❌ Failed to connect to database:', err.message);
      return;
    }

    // Define the polling cycle
    const tick = async () => {
      try {
        // Single service startup mode
        if (serviceId && token) {
          await this._pollService(serviceId, token, guildId);
          return;
        }

        // Otherwise, poll all stored Nitrado credentials
        const { rows } = await this.pool.query(`
          SELECT guild_id, service_id, encrypted_token, token_iv, auth_tag
          FROM nitrado_credentials
          WHERE active = TRUE
        `);

        if (!rows.length) {
          logger.warn('[NitradoPollingMonitor] ⚠️ No active Nitrado credentials found.');
          return;
        }

        for (const cred of rows) {
          try {
            const token = decrypt(cred.encrypted_token, cred.token_iv, cred.auth_tag);
            await this._pollService(cred.service_id, token, cred.guild_id);
          } catch (err) {
            logger.warn(`[NitradoPollingMonitor] ⚠️ Polling failed for ${cred.service_id}: ${err.message}`);
          }
        }
      } catch (err) {
        logger.error(`[NitradoPollingMonitor] ❌ Polling cycle failed: ${err.message}`);
      }
    };

    // Run first check immediately, then on an interval
    await tick().catch((err) => logger.error('[NitradoPollingMonitor] Initial tick failed:', err.message));

    this.timer = setInterval(async () => {
      await tick().catch((err) => logger.error('[NitradoPollingMonitor] Scheduled tick failed:', err.message));
    }, this.interval);
  }

  /**
   * Poll a single service
   */
  async _pollService(serviceId, token, guildId) {
    try {
      // ✅ Defensive construction (auto-fix for undefined.bind)
      let api;
      try {
        api = createNitradoAPI(token);
      } catch (err) {
        logger.error(`[NitradoPollingMonitor] ⚠️ Failed to create NitradoAPI instance: ${err.message}`);
        return;
      }

      if (!api?.getServiceInfo) {
        logger.warn('[NitradoPollingMonitor] ⚠️ API instance missing getServiceInfo(), skipping...');
        return;
      }

      const info = await api.getServiceInfo(serviceId);
      const status = info?.status || 'unknown';

      if (status !== 'active' && status !== 'running') {
        logger.warn(`[NitradoPollingMonitor] ⚠️ Service ${serviceId} is ${status}`);
        await this._notifyGuild(guildId, status);
      } else {
        logger.debug(`[NitradoPollingMonitor] ✅ Service ${serviceId} active`);
      }
    } catch (err) {
      logger.error(`[NitradoPollingMonitor] ❌ Error polling service ${serviceId}: ${err.message}`);
    }
  }

  /**
   * Notify guild of service issues
   */
  async _notifyGuild(guildId, status) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    const adminChannel =
      guild.channels.cache.find((c) => c.name.includes('admin')) ||
      guild.systemChannel ||
      guild.channels.cache.find((c) => c.type === 0);

    if (!adminChannel) return;

    await adminChannel.send({
      embeds: [
        {
          color: 0xff9800,
          title: '⚠️ Nitrado Service Alert',
          description: `Your Nitrado service is currently **${status.toUpperCase()}**.`,
          footer: { text: 'Grizzly Bot - Nitrado Polling Monitor' },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  /**
   * Stop the monitor
   */
  stopMonitoring() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    logger.info('[NitradoPollingMonitor] 🧹 Polling Monitor stopped.');
  }
}

module.exports = NitradoPollingMonitor;
