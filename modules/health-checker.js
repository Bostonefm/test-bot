
const logger = require('./logger');
const db = require('./db');

class HealthChecker {
  constructor(client) {
    this.client = client;
    this.healthInterval = null;
  }

  start() {
    // Check health every 5 minutes
    this.healthInterval = setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
    logger.info('Health checker started');
  }

  stop() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
      logger.info('Health checker stopped');
    }
  }

  async performHealthCheck() {
    try {
      const checks = {
        bot: this.client.isReady(),
        database: await this.checkDatabase(),
        memory: this.checkMemoryUsage(),
        guilds: this.client.guilds.cache.size
      };

      if (!checks.bot || !checks.database) {
        logger.error('Health check failed:', checks);
      } else {
        logger.info('Health check passed:', checks);
      }

      return checks;
    } catch (error) {
      logger.error('Health check error:', error);
      return { error: error.message };
    }
  }

  async checkDatabase() {
    try {
      const result = await db.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  checkMemoryUsage() {
    const used = process.memoryUsage();
    return {
      rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100
    };
  }
}

module.exports = HealthChecker;
