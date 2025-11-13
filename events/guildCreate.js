const logger = require('../config/logger.js');

/**
 * GuildCreate event handler - fires when bot joins a new guild
 * NOTE: Auto-bootstrap disabled - admins must manually run /setup server
 */
module.exports = (client) => {
  client.on('guildCreate', async (guild) => {
    logger.info(`✅ Joined new guild: ${guild.name} (${guild.id})`);
    logger.info(`⚠️ Auto-bootstrap disabled. Guild admin should run /setup server to configure the bot.`);
    
    // Send a welcome message to the guild owner if possible
    try {
      const owner = await guild.fetchOwner();
      if (owner) {
        await owner.send(
          `👋 **Thank you for adding Grizzly Bot to ${guild.name}!**\n\n` +
          `To get started, run this command in your server:\n` +
          `\`/setup server\`\n\n` +
          `This will create all necessary channels and roles.\n\n` +
          `**Note:** Grizzly Bot requires an active Patreon subscription (Bronze tier or higher).\n` +
          `Subscribe at: https://patreon.com/grizzlygaming`
        );
        logger.info(`Sent setup instructions to guild owner: ${owner.user.tag}`);
      }
    } catch (dmError) {
      logger.warn(`Could not DM guild owner: ${dmError.message}`);
    }
  });
};
