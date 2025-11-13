const { handleMemberJoin } = require('../modules/welcomeHandler.js');
const logger = require('../config/logger.js');

/**
 * guildMemberAdd event handler - fires when a new member joins the server
 */
module.exports = (client) => {
  client.on('guildMemberAdd', async (member) => {
    try {
      await handleMemberJoin(member);
      logger.info(`✅ Sent welcome message for ${member.user.tag} in ${member.guild.name}`);
    } catch (error) {
      logger.error(`❌ Failed to handle member join for ${member.user.tag}:`, error);
    }
  });
};
