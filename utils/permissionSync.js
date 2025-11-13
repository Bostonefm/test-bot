const { PermissionsBitField } = require('discord.js');
const centralConfig = require('../config/central.config.json');
const subscriberConfig = require('../config/subscriber.config.json');
const logger = require('../config/logger.js');
const { updateChannelPermissions } = require('../utils/permissionManager.js');

/**
 * Sync all channel permissions on bot startup
 * @param {Client} client - Discord client instance
 */
async function syncAllPermissions(client) {
  const syncResults = [];

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const isGCC = guildId === process.env.GRIZZLY_COMMAND_GUILD_ID;
      const config = isGCC ? centralConfig : subscriberConfig;
      
      logger.info(`🔄 Syncing permissions for ${guild.name} (${isGCC ? 'GCC' : 'Subscriber'})`);

      let channelsSynced = 0;
      let channelsSkipped = 0;

      // New config format uses channelPermissions object
      const channelPermissions = config.channelPermissions || {};

      // Sync permissions for each channel defined in config
      for (const [channelName, channelConfig] of Object.entries(channelPermissions)) {
        // Find channel by name (ignore category - work with existing structure)
        const channel = guild.channels.cache.find(c => c.name === channelName && c.type === 0); // 0 = GUILD_TEXT

        if (!channel) {
          logger.warn(`⚠️ Channel not found: ${channelName} (skipping - channel must exist first)`);
          channelsSkipped++;
          continue;
        }

        // Update permissions using the permission manager
        try {
          await updateChannelPermissions(channel, { permissions: channelConfig.permissions }, guild, false);
          channelsSynced++;
          logger.info(`✅ Synced: #${channelName}`);
        } catch (permError) {
          logger.error(`❌ Failed to sync #${channelName}:`, permError.message);
          channelsSkipped++;
        }
      }

      syncResults.push({
        guild: guild.name,
        synced: channelsSynced,
        skipped: channelsSkipped,
        success: true
      });

      logger.info(`✅ ${guild.name}: ${channelsSynced} channels synced, ${channelsSkipped} skipped`);

    } catch (error) {
      logger.error(`❌ Permission sync failed for ${guild.name}:`, error.message, error.stack);
      syncResults.push({
        guild: guild.name,
        error: error.message,
        success: false
      });
    }
  }

  return syncResults;
}

module.exports = { syncAllPermissions };
