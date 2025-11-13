const { getPool } = require('./db');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');
const { createNitradoAPI } = require('./nitrado.js');

class NitradoResourceMonitor {
  constructor(client) {
    this.client = client;
    this.checkInterval = 10 * 60 * 1000; // Check every 10 minutes
    this.isRunning = false;
    this.intervalId = null;
    this.pool = null;
  }

  async start() {
    if (this.isRunning) {
      logger.info('⚠️  Resource monitor already running');
      return;
    }

    this.pool = await getPool();
    this.isRunning = true;
    logger.info('📊 Starting Nitrado resource monitor...');

    await this.checkAllServices();

    this.intervalId = setInterval(async () => {
      await this.checkAllServices();
    }, this.checkInterval);

    logger.info(`✅ Resource monitor started (checks every ${this.checkInterval / 1000 / 60} minutes)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('📉 Resource monitor stopped');
  }

  async checkAllServices() {
    try {
      const credResult = await this.pool.query(`
        SELECT DISTINCT nc.service_id, nc.guild_id, nc.encrypted_token, nc.token_iv, nc.auth_tag
        FROM nitrado_credentials nc
        INNER JOIN nitrado_oauth_tokens ot ON nc.discord_id = ot.discord_id
        WHERE ot.expires_at > NOW() + INTERVAL '5 minutes'
      `);

      if (credResult.rows.length === 0) return;

      logger.info(`📈 Collecting resource stats for ${credResult.rows.length} services`);

      for (const cred of credResult.rows) {
        try {
          const token = decrypt(cred.encrypted_token, cred.token_iv, cred.auth_tag);
          await this.collectResourceStats(cred.service_id, cred.guild_id, token);
        } catch (error) {
          logger.error(`❌ Error collecting stats for service ${cred.service_id}:`, error.message);
        }
      }
    } catch (error) {
      logger.error('❌ Error in resource monitor:', error);
    }
  }

  async collectResourceStats(serviceId, guildId, token) {
    try {
      const api = createNitradoAPI(token);
      const result = await api.getServerStats(serviceId);

      if (!result?.data?.data?.stats) {
        logger.warn(`⚠️  No stats found for service ${serviceId}`);
        return;
      }

      const stats = result.data.data.stats;
      const latestDataPoints = {
        currentPlayers: stats.currentPlayers?.at(-1) || [0, Date.now() / 1000],
        maxPlayers: stats.maxPlayers?.at(-1) || [0, Date.now() / 1000],
        cpuUsage: stats.cpuUsage?.at(-1) || [0, Date.now() / 1000],
        memoryUsage: stats.memoryUsage?.at(-1) || [0, Date.now() / 1000],
      };

      await this.storeResourceStats(serviceId, guildId, latestDataPoints);
      logger.debug(`✅ Stored resource stats for service ${serviceId}`);
    } catch (error) {
      const code = error.response?.status;
      if (code === 401) logger.warn(`🔒 Token expired for service ${serviceId}`);
      else if (code === 429) logger.warn(`⏱️  Rate limited on service ${serviceId}`);
      else if (code === 404) logger.debug(`ℹ️  Stats not available for service ${serviceId}`);
      else logger.error(`❌ Error fetching stats for ${serviceId}:`, error.message);
    }
  }

  async storeResourceStats(serviceId, guildId, dataPoints) {
    try {
      const timestamp = Math.floor(dataPoints.currentPlayers[1]);
      await this.pool.query(
        `
        INSERT INTO resource_stats (
          service_id, guild_id, current_players, max_players,
          cpu_usage, memory_usage, data_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (service_id, data_timestamp) DO NOTHING
      `,
        [
          serviceId,
          guildId,
          Math.round(dataPoints.currentPlayers[0]) || 0,
          Math.round(dataPoints.maxPlayers[0]) || 0,
          parseFloat(dataPoints.cpuUsage[0]) || null,
          parseFloat(dataPoints.memoryUsage[0]) || null,
          timestamp,
        ]
      );
    } catch (error) {
      logger.error(`❌ Error storing resource stats:`, error.message);
    }
  }

  async cleanOldStats(daysToKeep = 7) {
    try {
      const result = await this.pool.query(`
        DELETE FROM resource_stats
        WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
      `);
      logger.info(`🧹 Cleaned ${result.rowCount} old resource stat records`);
    } catch (error) {
      logger.error('❌ Error cleaning old stats:', error);
    }
  }
}

module.exports = NitradoResourceMonitor;
