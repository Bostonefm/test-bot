const fs = require("fs");
const path = require("path");
const { ChannelType } = require("discord.js");
const logger = require("../config/logger.js");
const { updateChannelPermissions } = require("../utils/permissionManager.js");

/**
 * Bootstraps a Discord guild by applying permissions to existing channels.
 * @param {Guild} guild - The Discord guild to configure.
 * @param {string} configType - "central" | "subscriber" | "assistant"
 */
async function configBootstrap(guild, configType = "subscriber") {
  try {
    const configPath = path.join(__dirname, `../config/${configType}.config.json`);
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

    logger.info(`🚀 Applying permissions for ${configType} server: ${guild.name}`);

    // 1️⃣ Ensure required roles exist (create if missing, except Patreon roles)
    const patreonRoles = ['🥉Bronze', '🥈Silver', '🥇Gold', 'Partner'];
    
    for (const roleName of configData.requiredRoles || []) {
      let role = guild.roles.cache.find(r => r.name === roleName);
      
      if (!role && !patreonRoles.includes(roleName)) {
        // Create non-Patreon roles
        role = await guild.roles.create({
          name: roleName,
          mentionable: true,
          reason: `Required role for ${configType} server configuration`,
        });
        logger.info(`✅ Created role: ${roleName}`);
      } else if (!role && patreonRoles.includes(roleName)) {
        logger.warn(`⚠️ Patreon role not found: ${roleName} (should be created by Discord Linked Roles)`);
      } else {
        logger.info(`✅ Role exists: ${roleName}`);
      }
    }

    // 2️⃣ Apply permissions to existing channels
    const channelPermissions = configData.channelPermissions || {};
    let updatedCount = 0;
    let notFoundCount = 0;

    for (const [channelName, config] of Object.entries(channelPermissions)) {
      // Find existing channel by name
      const channel = guild.channels.cache.find(c => c.name === channelName);
      
      if (channel) {
        // Apply permissions to existing channel
        await updateChannelPermissions(channel, { permissions: config.permissions }, guild, false);
        logger.info(`✅ Applied permissions to existing channel: ${channelName}`);
        
        // Update topic if provided
        if (config.topic && channel.setTopic) {
          await channel.setTopic(config.topic);
          logger.info(`✅ Updated topic for: ${channelName}`);
        }
        
        updatedCount++;
      } else {
        logger.warn(`⚠️ Channel not found: ${channelName} (skipping - channel must exist first)`);
        notFoundCount++;
      }
    }

    logger.info(`✅ Permission update complete: ${updatedCount} channels updated, ${notFoundCount} channels not found.`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to apply ${configType} permissions:`, error);
    return false;
  }
}

module.exports = { configBootstrap };
