const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const logger = require('../config/logger');
const feedMap = require('../config/feedMap.config.json');
const db = require('../modules/db');

const ADMIN_ROLES = ['Admin', 'Moderator', 'Staff'];

class DiscordNotificationSystem {
  constructor(client) {
    this.client = client;
  }

  async processEvent(event, guild) {
    try {
      if (!event || !guild) return;

      // Base feed definition
      let feed = feedMap.default[event.type] || feedMap.default[event.type?.toLowerCase()];
      if (!feed) {
        feed = feedMap.default.killfeed; // fallback
        logger.warn(`⚠️ Unknown feed type "${event.type}", using fallback`);
      }

      // 🔹 Apply guild-specific overrides if present
      const res = await db.query(
        'SELECT visibility, show_location FROM guild_feed_settings WHERE guild_id=$1 AND feed_name=$2',
        [guild.id, feed.channelName || event.type]
      );
      if (res.rowCount > 0) {
        const override = res.rows[0];
        feed.visibility = override.visibility || feed.visibility;
        feed.showLocation = override.show_location ?? feed.showLocation;
      }

      // Ensure feed channel exists
      let channel = guild.channels.cache.find(c => c.name === feed.channelName);
      if (!channel) {
        const category = guild.channels.cache.find(
          c => c.name === 'Grizzly Feeds' && c.type === ChannelType.GuildCategory
        );
        const parent = category || await guild.channels.create({
          name: 'Grizzly Feeds',
          type: ChannelType.GuildCategory
        });

        channel = await guild.channels.create({
          name: feed.channelName,
          type: ChannelType.GuildText,
          parent: parent.id,
          permissionOverwrites: this._buildPermissions(guild, feed)
        });
        logger.info(`🆕 Created feed channel: ${feed.channelName}`);
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(feed.color || 0x2f3136)
        .setTitle(feed.title || `📡 ${event.type}`)
        .setDescription(this._buildDescription(event))
        .setTimestamp(new Date(event.timestamp || Date.now()));

      if (event.position) {
        if (feed.showLocation) {
          embed.addFields({
            name: '🗺️ Location',
            value: `X: ${event.position.x.toFixed(2)}  Z: ${event.position.z.toFixed(2)}`
          });
        } else {
          embed.addFields({ name: '🛰️ Location', value: 'Hidden (Admin only)' });
        }
      }

      await channel.send({ embeds: [embed] });
      logger.info(`📤 [${guild.name}] ${event.type} → #${feed.channelName}`);
    } catch (err) {
      logger.error(`Error sending event notification: ${err.message}`);
    }
  }

  _buildPermissions(guild, feed) {
    const perms = [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel],
      }
    ];

    const allowedRoles = feed.roles || [];
    const allowList = allowedRoles.concat(feed.visibility === 'admin' ? ADMIN_ROLES : []);
    allowList.forEach(roleName => {
      const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
      if (role) perms.push({ id: role.id, allow: [PermissionsBitField.Flags.ViewChannel] });
    });

    return perms;
  }

  _buildDescription(event) {
    let desc = event.rawLine || 'No details logged';
    if (event.weapon) desc += `\nWeapon: ${event.weapon}`;
    if (event.item) desc += `\nItem: ${event.item}`;
    if (event.structure) desc += `\nStructure: ${event.structure}`;
    return desc;
  }
}

module.exports = DiscordNotificationSystem;
