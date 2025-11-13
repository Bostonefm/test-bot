const logger = require('../config/logger.js');

/**
 * Handle slash command interactions
 * @param {CommandInteraction} interaction - Discord command interaction
 * @param {Client} client - Discord client instance
 */
async function handleCommand(interaction, client) {
  const startTime = Date.now();
  const createdAt = interaction.createdTimestamp;
  const latency = startTime - createdAt;
  
  logger.info(`📊 Command: ${interaction.commandName} | Latency: ${latency}ms | Created: ${new Date(createdAt).toISOString()}`);
  
  if (latency > 2000) {
    logger.warn(`🐌 SLOW: Command took ${latency}ms to reach handler (>2s = will fail!)`);
  }
  
  const command = client.commands.get(interaction.commandName);
  
  if (!command) {
    logger.warn(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    const executeStart = Date.now();
    logger.info(`🚀 Executing ${interaction.commandName} at ${executeStart - startTime}ms after handler start`);
    
    // Pass client context with pool and logger
    await command.execute(interaction, {
      pool: client.pool,
      logger: logger,
      client: client
    });
    
    const executeEnd = Date.now();
    logger.info(`✅ ${interaction.commandName} completed in ${executeEnd - executeStart}ms (total: ${executeEnd - createdAt}ms)`);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);

    // Try to send error response (interaction is already deferred)
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: `❌ **Command Error**\n\n${error.message || 'An unexpected error occurred'}`,
        });
      }
    } catch (replyError) {
      logger.error('Could not send error reply:', replyError);
    }
  }
}

module.exports = { handleCommand };
