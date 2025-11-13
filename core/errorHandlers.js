const logger = require('../config/logger.js');

/**
 * Setup global error handlers and graceful shutdown
 * @param {Client} client - Discord client instance
 */
function setupErrorHandlers(client) {
  // Handle unexpected promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`🧨 Unhandled Rejection: ${reason?.stack || reason}`);
  });

  // Handle synchronous exceptions
  process.on('uncaughtException', (error) => {
    logger.error(`💥 Uncaught Exception: ${error.stack || error}`);
  });

  // Handle Discord client disconnects gracefully
  client.on('shardDisconnect', (event, shardId) => {
    logger.warn(`🔌 Shard ${shardId} disconnected (${event.code}). Attempting to reconnect...`);
  });

  // Handle reconnects
  client.on('shardReconnecting', (shardId) => {
    logger.info(`🔄 Shard ${shardId} reconnecting...`);
  });

  // Confirm resumed connection
  client.on('shardResume', (shardId) => {
    logger.info(`✅ Shard ${shardId} resumed successfully`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Clear global references
    if (global.wsManager) {
      global.wsManager.disconnectAll?.();
      global.wsManager = null;
    }

    client.destroy();
    
    const { db } = require('../modules/db.js');
    await db.close();
    
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = setupErrorHandlers;
