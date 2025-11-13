const { ChannelType } = require('discord.js');
const config = require('./config/subscriber.config.json');
const logger = require('./utils/logger.js');
const { db } = require('./modules/db.js');

async function bootstrapGuild(guild, client) {
  // === Auto-start Nitrado monitoring after guild setup ===
  try {
    const NitradoPollingMonitor = require('./modules/nitradoPollingMonitor.js');

    // Ensure we have a shared instance of the monitor
    if (!client.nitradoPollingMonitor) {
      client.nitradoPollingMonitor = new NitradoPollingMonitor(client);
    }

    // Fetch saved Nitrado credentials for this guild
    const nitradoCreds = await db.getNitradoCreds(guild.id);

    if (nitradoCreds?.encrypted_token && nitradoCreds?.service_id) {
      // Decrypt token using existing utility
      const { decrypt } = require('./utils/encryption.js');
      const token = decrypt(
        nitradoCreds.encrypted_token,
        nitradoCreds.token_iv,
        nitradoCreds.auth_tag
      );

      // Define log output channel (temporary default)
      const logChannelId = process.env.DEFAULT_LOG_CHANNEL_ID || null;

      if (logChannelId) {
        await client.nitradoPollingMonitor.startMonitoring(
          nitradoCreds.service_id,
          token,
          logChannelId
        );
        logger.info(`✅ Auto-started Nitrado monitoring for guild ${guild.name}`);
      } else {
        logger.warn(
          `⚠️ No default log channel defined for ${guild.name}. Set DEFAULT_LOG_CHANNEL_ID in .env`
        );
      }
    } else {
      logger.info(`ℹ️ No Nitrado credentials found for ${guild.name}, skipping monitoring start`);
    }
  } catch (err) {
    logger.error(`❌ Failed to auto-start Nitrado monitoring for guild ${guild.name}:`, err);
  }

  // === Guild Bootstrap Setup ===
  try {
    logger.info(`Starting bootstrap for guild: ${guild.name} (${guild.id})`);

    const hasAssistantBot = guild.members.cache.some(member =>
      member.user.username.toLowerCase().includes('assistant')
    );

    if (hasAssistantBot) {
      logger.info(`Assistant Bot detected in ${guild.name} - preserving Assistant Bot channels`);
    }

    // Create categories and channels from subscriber.config.json
    for (const [categoryName, channelNames] of Object.entries(config.bootstrap.categories)) {
      // Idempotently create or reuse category, applying permission overwrites
      let category = guild.channels.cache.find(
        c => c.name === categoryName && c.type === ChannelType.GuildCategory
      );

      if (!category) {
        category = await guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory,
          permissionOverwrites: config.permissions?.categories?.[categoryName] || [],
        });
      }

      for (const channelName of channelNames) {
        // Idempotently create or reuse text channel under this category
        let channel = guild.channels.cache.find(
          c => c.name === channelName && c.parentId === category.id
        );

        if (!channel) {
          await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: config.permissions?.channels?.[channelName] || [],
          });
        }
      }
    }

    // Send welcome message only once
    const welcomeChannel = guild.channels.cache.find(
      c => c.name === config.bootstrap.welcomeChannel
    );

    if (welcomeChannel) {
      const fetched = await welcomeChannel.messages.fetch({ limit: 50 });
      const hasWelcome = fetched.some(
        m => m.author.id === client.user.id && m.content.includes('Welcome to')
      );

      if (!hasWelcome) {
        await welcomeChannel.send(`Welcome to **${guild.name}**, thanks for inviting me!`);
      }
    }

    // Fetch all members to populate cache
    await guild.members.fetch();

    // Check bot permissions if client is available
    const botMember = guild.members.cache.get(client.user.id);
    if (botMember && !botMember.permissions.has('Administrator')) {
      logger.warn(`⚠️ Bot lacks Administrator permissions in guild: ${guild.name}`);
    }
  } catch (error) {
    logger.error(`Error during bootstrap for guild ${guild.name}: ${error.message}`, error);
  }
}

module.exports = {
  bootstrapGuild,
};
