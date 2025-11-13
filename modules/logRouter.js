// ============================================================
// 🧩 Grizzly Bot — Cleaned Module: logRouter.js
// Routes parsed DayZ log events to proper Discord channels
// ============================================================

const logger = require('../config/logger.js');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const feedConfig = require('../config/feedMap.config.json');

// Helper to fetch feed configuration
function getFeedSettings(feedName) {
  const root = feedConfig.default || feedConfig;
  return root[feedName] || null;
}

// ─────────────────────────────────────────────
// 📨 Log Router
// Handles dispatch of events → Discord channels
// ─────────────────────────────────────────────
class LogRouter {
  constructor(client) {
    this.client = client;
  }

  async routeEvent(event, guildId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return logger.warn(`⚠️ Guild ${guildId} not found in cache`);

      const feed = getFeedSettings(event.type);
      if (!feed) return logger.debug(`⚙️ No feed mapping found for type: ${event.type}`);

      const channel = guild.channels.cache.get(feed.channelId);
      if (!channel) {
        logger.warn(`⚠️ Feed channel for ${event.type} not found in ${guild.name}`);
        return;
      }

      // Skip based on feed visibility
      if (feed.visibility === 'admin' && !this._isAdminGuild(guild)) {
        return logger.debug(`🔒 Skipping ${event.type} for non-admin guild: ${guild.name}`);
      }

      // Format embed
      const embed = this._buildEmbed(event, feed);

      // Send message
      await channel.send({ embeds: [embed] });
      logger.info(`📨 Sent ${event.type} → #${channel.name} (${guild.name})`);
    } catch (err) {
      logger.error(`❌ Failed to route log event (${event.type}): ${err.message}`);
    }
  }

  // 📋 Handle multiple events in bulk
  async routeEvents(events, guildId) {
    for (const e of events) {
      await this.routeEvent(e, guildId);
    }
  }

  // 🧠 Build a clean, informative embed
  _buildEmbed(event, feed) {
    const colorMap = {
      kill: 0xff1744,
      death: 0xe53935,
      connection: 0x4caf50,
      disconnection: 0xff9800,
      vehicle: 0x00bcd4,
      base_building: 0x8bc34a,
      raid: 0xc62828,
      economy: 0x607d8b,
      dynamic_event: 0x9c27b0,
      admin_action: 0xfdd835,
      broadcast: 0x03a9f4,
      misc: 0x9e9e9e,
    };

    const embed = new EmbedBuilder()
      .setColor(colorMap[event.type] || 0x607d8b)
      .setTitle(`📜 ${event.type.replace(/_/g, ' ').toUpperCase()}`)
      .setDescription(this._formatEventDescription(event))
      .setFooter({ text: `Service: ${event.serviceId || 'Unknown'}` })
      .setTimestamp();

    // Add location if allowed
    if (feed.showLocation && event.position) {
      embed.addFields({
        name: '📍 Location',
        value: `X: ${event.position.x.toFixed(2)} | Y: ${event.position.y.toFixed(2)} | Z: ${event.position.z.toFixed(2)}`,
        inline: false,
      });
    }

    return embed;
  }

  // 📄 Format message description
  _formatEventDescription(event) {
    const parts = [];
    if (event.rawLine) parts.push(`\`${event.rawLine}\``);
    if (event.weapon) parts.push(`**Weapon:** ${event.weapon}`);
    if (event.distance) parts.push(`**Distance:** ${event.distance}m`);
    if (event.hitZone) parts.push(`**Hit Zone:** ${event.hitZone}`);
    if (event.item) parts.push(`**Item:** ${event.item}`);
    if (event.structure) parts.push(`**Structure:** ${event.structure}`);
    return parts.join('\n');
  }

  // 🔐 Simple admin detection (based on roles)
  _isAdminGuild(guild) {
    const adminRoles = ['Admin', 'Moderator', 'Staff'];
    return guild.roles.cache.some(r => adminRoles.includes(r.name));
  }
}

module.exports = { LogRouter };
