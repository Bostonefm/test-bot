const { db } = require('./db.js');
const { NitradoAuthManager } = require('./nitradoAuth.js');
const logger = require('../config/logger.js');

class TokenAutoRefresh {
  constructor() {
    this.checkInterval = 15 * 60 * 1000;
    this.refreshBeforeExpiry = 30 * 60 * 1000;
    this.intervalId = null;
  }

  async start() {
    logger.info('🔄 Starting token auto-refresh service...');
    
    await this.checkAndRefreshTokens();
    
    this.intervalId = setInterval(async () => {
      await this.checkAndRefreshTokens();
    }, this.checkInterval);

    logger.info(`✅ Token auto-refresh service started (checks every ${this.checkInterval / 60000} minutes)`);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('🛑 Token auto-refresh service stopped');
    }
  }

  async checkAndRefreshTokens() {
    try {
      const expiryThreshold = new Date(Date.now() + this.refreshBeforeExpiry);
      
      const result = await db.query(
        `
        SELECT guild_id, discord_id, expires_at 
        FROM nitrado_oauth_tokens 
        WHERE expires_at < $1 AND expires_at > NOW()
        ORDER BY expires_at ASC
        `,
        [expiryThreshold]
      );

      if (result.rows.length === 0) {
        logger.debug('No tokens need refreshing');
        return;
      }

      logger.info(`Found ${result.rows.length} token(s) expiring soon, refreshing...`);

      const authManager = new NitradoAuthManager();

      for (const row of result.rows) {
        try {
          const timeUntilExpiry = new Date(row.expires_at).getTime() - Date.now();
          const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);

          logger.info(`Refreshing token for guild ${row.guild_id}, expires in ${minutesUntilExpiry} minutes`);

          const getServiceResult = await db.query(
            'SELECT service_id FROM nitrado_credentials WHERE guild_id = $1 AND discord_id = $2 LIMIT 1',
            [row.guild_id, row.discord_id]
          );

          if (getServiceResult.rows.length === 0) {
            logger.warn(`No service ID found for guild ${row.guild_id}, skipping refresh`);
            continue;
          }

          const serviceId = getServiceResult.rows[0].service_id;

          await authManager.refreshToken(row.guild_id, row.discord_id, serviceId);

          logger.info(`✅ Successfully refreshed token for guild ${row.guild_id}`);
        } catch (error) {
          logger.error(`Failed to refresh token for guild ${row.guild_id}: ${error.message}`);
          
          await db.query(
            `INSERT INTO token_refresh_errors (guild_id, discord_id, error_message, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [row.guild_id, row.discord_id, error.message]
          );
        }
      }
    } catch (error) {
      logger.error(`Token auto-refresh check failed: ${error.message}`);
    }
  }

  async getRefreshStatus() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '30 minutes') as expiring_soon,
          COUNT(*) FILTER (WHERE expires_at < NOW()) as expired,
          COUNT(*) as total
        FROM nitrado_oauth_tokens
      `);

      return result.rows[0];
    } catch (error) {
      logger.error(`Failed to get refresh status: ${error.message}`);
      return { expiring_soon: 0, expired: 0, total: 0 };
    }
  }
}

module.exports = TokenAutoRefresh;
