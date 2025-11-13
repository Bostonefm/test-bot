const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../config/logger');
const db = require('../utils/db');

const feedConfigPath = path.join(__dirname, '../config/feedMap.config.json');

function loadFeedConfig() {
  return JSON.parse(fs.readFileSync(feedConfigPath, 'utf8'));
}

/* 🔹 Database Helpers */
async function getGuildFeedSetting(guildId, feedName) {
  const result = await db.query(
    'SELECT visibility, show_location FROM guild_feed_settings WHERE guild_id=$1 AND feed_name=$2',
    [guildId, feedName]
  );
  return result.rows[0] || null;
}

async function setGuildFeedSetting(guildId, feedName, visibility, showLocation) {
  await db.query(
    `INSERT INTO guild_feed_settings (guild_id, feed_name, visibility, show_location)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, feed_name)
     DO UPDATE SET visibility=EXCLUDED.visibility, show_location=EXCLUDED.show_location, updated_at=NOW()`,
    [guildId, feedName, visibility, showLocation]
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('feed')
    .setDescription('Manage per-guild feed visibility and location settings.')
    .addSubcommand(sub =>
      sub
        .setName('toggle-location')
        .setDescription('Toggle coordinate visibility for a feed.')
        .addStringOption(opt =>
          opt.setName('feed').setDescription('Feed name (killfeed, events, etc.)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle-visibility')
        .setDescription('Toggle a feed between public and admin visibility.')
        .addStringOption(opt =>
          opt.setName('feed').setDescription('Feed name (killfeed, events, etc.)').setRequired(true)
        )
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List current feed settings.'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    await interaction.deferReply({ ephemeral: true });

    try {
      const feedMap = loadFeedConfig();
      const root = feedMap.default;

      switch (subcommand) {
        /* ──────────────── TOGGLE LOCATION ──────────────── */
        case 'toggle-location': {
          const feedName = interaction.options.getString('feed');
          if (!root[feedName]) return this._missingFeed(interaction, feedName);

          const currentDB = await getGuildFeedSetting(guildId, feedName);
          const showLocation = currentDB ? !currentDB.show_location : !root[feedName].showLocation;
          const visibility = currentDB ? currentDB.visibility : root[feedName].visibility;

          await setGuildFeedSetting(guildId, feedName, visibility, showLocation);

          const status = showLocation ? '`Enabled` ✅' : '`Disabled` ❌';
          const embed = new EmbedBuilder()
            .setColor(showLocation ? 0x4caf50 : 0xf44336)
            .setTitle('🛰️ Location Visibility Updated')
            .setDescription(`Feed: **${feedName}**\nStatus: ${status}`)
            .setTimestamp();

          logger.info(`🛰️ [${guildId}] ${feedName} showLocation → ${showLocation}`);
          return interaction.editReply({ embeds: [embed] });
        }

        /* ──────────────── TOGGLE VISIBILITY ──────────────── */
        case 'toggle-visibility': {
          const feedName = interaction.options.getString('feed');
          if (!root[feedName]) return this._missingFeed(interaction, feedName);

          const currentDB = await getGuildFeedSetting(guildId, feedName);
          const current = currentDB ? currentDB.visibility : root[feedName].visibility || 'public';
          const newVis = current === 'public' ? 'admin' : 'public';
          const showLocation = currentDB ? currentDB.show_location : root[feedName].showLocation;

          await setGuildFeedSetting(guildId, feedName, newVis, showLocation);

          const embed = new EmbedBuilder()
            .setColor(newVis === 'admin' ? 0xff9800 : 0x03a9f4)
            .setTitle('🔒 Feed Visibility Updated')
            .setDescription(
              `Feed: **${feedName}**\nNow set to: **${newVis.toUpperCase()}** ${
                newVis === 'admin' ? '(Admin/Mod/Staff only)' : '(Visible to all players)'
              }`
            )
            .setTimestamp();

          logger.info(`🔒 [${guildId}] ${feedName} visibility → ${newVis}`);
          return interaction.editReply({ embeds: [embed] });
        }

        /* ──────────────── LIST FEEDS ──────────────── */
        case 'list': {
          const rows = [];
          for (const [name, feed] of Object.entries(root)) {
            const override = await getGuildFeedSetting(guildId, name);
            const showLocation = override ? override.show_location : feed.showLocation;
            const visibility = override ? override.visibility : feed.visibility;
            const locIcon = showLocation ? '🟢' : '🔴';
            const visIcon = visibility === 'admin' ? '🛠️ Admin' : '👥 Public';
            rows.push(`**${name}** — ${visIcon} | ${locIcon} ${showLocation ? 'Coords On' : 'Coords Off'}`);
          }

          const embed = new EmbedBuilder()
            .setColor(0x2196f3)
            .setTitle('📋 Guild Feed Settings')
            .setDescription(rows.join('\n') || 'No feeds found.')
            .setFooter({ text: 'Use /feed toggle-location or /feed toggle-visibility to modify.' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (err) {
      logger.error(`Feed command error: ${err.message}`);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor(0xff0000).setTitle('❌ Feed Command Error').setDescription(err.message)
        ]
      });
    }
  },

  async _missingFeed(interaction, feedName) {
    const embed = new EmbedBuilder()
      .setColor(0xff4747)
      .setTitle('⚠️ Feed Not Found')
      .setDescription(`No feed named **${feedName}** exists in the config.`);
    return interaction.editReply({ embeds: [embed] });
  }
};
