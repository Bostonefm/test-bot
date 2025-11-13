const cron = require('node-cron');
const logger = require('../utils/logger.js');
const { runAllCleanupTasks } = require('./logCleanup.js');

/**
 * Initialize all scheduled tasks
 */
function initializeScheduler() {
  logger.info('⏰ Initializing scheduled tasks...');

  // 🧹 Daily cleanup at 3 AM (retention: 30 days)
  cron.schedule('0 3 * * *', async () => {
    logger.info('⏰ Running scheduled log cleanup (3:00 AM)');
    try {
      await runAllCleanupTasks(30);
    } catch (error) {
      logger.error(`Scheduled cleanup failed: ${error.message}`);
    }
  });

  logger.info('✅ Scheduled tasks initialized:');
  logger.info('   📅 Daily log cleanup: 3:00 AM (retention: 30 days)');
}

module.exports = { initializeScheduler };
