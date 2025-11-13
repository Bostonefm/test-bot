const { ChannelType, PermissionsBitField } = require("discord.js");
const config = require("../config/subscriber.config.json");
const logger = require("../utils/logger.js");
const { db } = require("./db.js");
const { decrypt } = require("../utils/encryption.js");
const NitradoPollingMonitor = require("./nitradoPollingMonitor.js");

/**
 * Bootstraps a guild's Discord structure on first setup or when revalidated.
 * - Creates categories & channels based on subscriber.config.json
 * - Applies role-based permissions
 * - Sends one-time starter messages
 * - Starts Nitrado monitoring if credentials exist
 */
async function bootstrapGuild(guild, client) {
  try {
    logger.info(`🚀 Bootstrapping guild: ${guild.name} (${guild.id})`);

    // --- Ensure required roles exist ---
    for (const roleName of config.requiredRoles) {
      let role = guild.roles.cache.find(r => r.name === roleName);
      if (!role) {
        role = await guild.roles.create({
          name: roleName,
          reason: "Auto-created required role during bootstrap",
        });
        logger.info(`🪄 Created missing role: ${roleName}`);
      }
    }

    // --- Create categories and channels ---
    for (const categoryData of config.categories) {
      const categoryName = categoryData.name;
      let category = guild.channels.cache.find(
        c => c.name === categoryName && c.type === ChannelType.GuildCategory
      );

      if (!category) {
        category = await guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory,
          reason: "Creating base structure",
        });
        logger.info(`📁 Created category: ${categoryName}`);
      }

      // Create channels in each category
      for (const channelName of categoryData.channels) {
        let channel = guild.channels.cache.find(
          c => c.name === channelName && c.parentId === category.id
        );

        if (!channel) {
          channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            reason: "Creating required channel",
          });
          logger.info(`🧩 Created channel: ${channelName}`);
        }

        // Apply starter message if defined
        const starterMessage = config.starterMessages[channelName];
        if (starterMessage) {
          const recent = await channel.messages.fetch({ limit: 10 });
          const alreadySent = recent.some(
            m => m.author.id === client.user.id && m.content.includes(starterMessage.slice(0, 20))
          );

          if (!alreadySent) {
            await channel.send(starterMessage);
            logger.info(`💬 Posted starter message in #${channelName}`);
          }
        }
      }
    }

    // --- Start Nitrado monitoring if available ---
    try {
      const nitradoCreds = await db.getNitradoCreds(guild.id);
      if (nitradoCreds?.encrypted_token && nitradoCreds?.service_id) {
        const token = decrypt(
          nitradoCreds.encrypted_token,
          nitradoCreds.token_iv,
          nitradoCreds.auth_tag
        );

        if (!client.nitradoPollingMonitor) {
          client.nitradoPollingMonitor = new NitradoPollingMonitor(client);
        }

        // Pick a default feed channel (killfeed or event-feed)
        const feedChannel =
          guild.channels.cache.find(c => c.name === "killfeed") ||
          guild.channels.cache.find(c => c.name === "event-feed");

        if (feedChannel) {
          await client.nitradoPollingMonitor.startMonitoring(
            nitradoCreds.service_id,
            token,
            feedChannel.id
          );
          logger.info(`🛰️ Started Nitrado monitoring for ${guild.name}`);
        } else {
          logger.warn(`⚠️ No feed channel found to attach Nitrado logs in ${guild.name}`);
        }
      } else {
        logger.info(`No Nitrado credentials found for guild ${guild.name}`);
      }
    } catch (err) {
      logger.error(`Failed to initialize Nitrado monitoring: ${err.message}`);
    }

    logger.info(`✅ Guild bootstrap completed for ${guild.name}`);
  } catch (error) {
    logger.error(`❌ Error bootstrapping guild ${guild.name}: ${error.message}`, error);
  }
}

module.exports = { bootstrapGuild };
