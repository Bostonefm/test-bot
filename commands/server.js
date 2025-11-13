// commands/server.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getNitradoServiceStatus, getNitradoServerInfo } = require('../modules/nitrado');
const { DayZLogAnalyzer } = require('../modules/logAnalyzer');
const logger = require('../config/logger');
const { getPool } = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('View or manage your DayZ server')
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Check current server status and player count.')
    )
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Display server information such as name, map, and slots.')
    )
    .addSubcommand(sub =>
      sub
        .setName('report')
        .setDescription('Generate a detailed server activity report (admin only).')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    await interaction.deferReply();

    try {
      switch (sub) {
        /* 🟢 /server status */
        case 'status': {
          const pool = getPool();
          const { rows } = await pool.query(
            `SELECT service_id FROM nitrado_credentials WHERE guild_id = $1 AND active = TRUE`,
            [guildId]
          );
          if (!rows.length) {
            return interaction.editReply('⚠️ No linked Nitrado service found for this guild.');
          }

          const serviceId = rows[0].service_id;
          const status = await getNitradoServiceStatus(serviceId);
          const embed = new EmbedBuilder()
            .setColor(0x4caf50)
            .setTitle('🟢 Server Status')
            .addFields(
              { name: 'Server Name', value: status.name || 'Unknown', inline: true },
              { name: 'Status', value: status.status || 'N/A', inline: true },
              { name: 'Online Players', value: `${status.players || 0}/${status.slots || 0}`, inline: true },
              { name: 'Uptime', value: status.uptime || 'N/A', inline: true }
            )
            .setFooter({ text: 'Grizzly Gaming-GG | Powered by Nitrado + Neon' })
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }

        /* 🔵 /server info */
        case 'info': {
          const pool = getPool();
          const { rows } = await pool.query(
            `SELECT service_id FROM nitrado_credentials WHERE guild_id = $1 AND active = TRUE`,
            [guildId]
          );
          if (!rows.length) {
            return interaction.editReply('⚠️ No linked Nitrado service found for this guild.');
          }

          const serviceId = rows[0].service_id;
          const info = await getNitradoServerInfo(serviceId);

          const embed = new EmbedBuilder()
            .setColor(0x03a9f4)
            .setTitle('📘 Server Information')
            .addFields(
              { name: 'Name', value: info.name || 'Unknown', inline: true },
              { name: 'Game', value: info.game || 'DayZ', inline: true },
              { name: 'Map', value: info.map || 'N/A', inline: true },
              { name: 'Slots', value: `${info.slots || 0}`, inline: true },
              { name: 'IP Address', value: info.ip || 'Hidden', inline: true },
              { name: 'Version', value: info.version || 'Unknown', inline: true }
            )
            .setFooter({ text: 'Grizzly Gaming-GG | Powered by Nitrado + Neon' })
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }

        /* 🔴 /server report (Admin only) */
        case 'report': {
          if (
            !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
            !interaction.member.roles.cache.some(r =>
              ['Admin', 'Moderator', 'Staff'].includes(r.name)
            )
          ) {
            return interaction.editReply('🚫 You do not have permission to run this command.');
          }

          const pool = getPool();
          const { rows } = await pool.query(
            `SELECT service_id FROM nitrado_credentials WHERE guild_id = $1 AND active = TRUE`,
            [guildId]
          );
          if (!rows.length) {
            return interaction.editReply('⚠️ No linked Nitrado service found for this guild.');
          }

          const serviceId = rows[0].service_id;
          const analyzer = new DayZLogAnalyzer();
          const summary = await analyzer.generateSummary(serviceId);

          const embed = new EmbedBuilder()
            .setColor(0xff9800)
            .setTitle('📊 Server Activity Report')
            .setDescription('Summary of recent DayZ server events.')
            .addFields(
              { name: 'Kills', value: `${summary.kills || 0}`, inline: true },
              { name: 'Deaths', value: `${summary.deaths || 0}`, inline: true },
              { name: 'Connections', value: `${summary.connections || 0}`, inline: true },
              { name: 'Disconnections', value: `${summary.disconnects || 0}`, inline: true },
              { name: 'Economy Events', value: `${summary.economy || 0}`, inline: true },
              { name: 'Base Events', value: `${summary.base || 0}`, inline: true }
            )
            .setFooter({ text: 'Grizzly Gaming-GG | Powered by Nitrado + Neon' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        default:
          return interaction.editReply('⚠️ Unknown subcommand.');
      }
    } catch (err) {
      logger.error(`Server command error: ${err.message}`);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Command Error')
            .setDescription(err.message),
        ],
      });
    }
  },
};
