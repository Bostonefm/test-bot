const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getPool } = require('../modules/db');
const { createNitradoAPI } = require('../modules/nitrado');
const { DayZLogAnalyzer } = require('../modules/logAnalyzer');
const logger = require('../config/logger');
const { decrypt } = require('../utils/encryption');

// In-memory cache shared by analyzer & report
const logCache = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Advanced DayZ log management commands.')
    .addSubcommand(sub =>
      sub
        .setName('refresh')
        .setDescription('Force refresh of logs and analyzer summary.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    if (sub !== 'refresh') return interaction.editReply('⚠️ Unknown subcommand.');

    try {
      const guildId = interaction.guildId;
      const pool = getPool();

      // 🔐 Load credentials
      const { rows } = await pool.query(
        `SELECT service_id, encrypted_token, token_iv, auth_tag
         FROM nitrado_credentials
         WHERE guild_id = $1 AND service_id IS NOT NULL
         LIMIT 1`,
        [guildId]
      );

      if (!rows.length) {
        return interaction.editReply('❌ No Nitrado credentials found for this guild.');
      }

      const { service_id, encrypted_token, token_iv, auth_tag } = rows[0];
      const decryptedToken = decrypt(encrypted_token, token_iv, auth_tag);
      const nitrado = createNitradoAPI(decryptedToken);
      const analyzer = new DayZLogAnalyzer();

      await interaction.editReply('♻️ Fetching latest DayZ logs...');

      // 📥 Pull + parse
      const logs = await analyzer.fetchRecentLogs(service_id, 5);
      const events = [];
      for (const line of logs) {
        const parsed = analyzer.parseLogEntry(line, service_id);
        if (parsed) events.push(parsed);
      }

      // 📊 Generate summary
      const summary = await analyzer.generateSummary(service_id);

      // 🧠 Cache results
      logCache.set(guildId, {
        timestamp: new Date(),
        summary,
        eventCount: events.length,
      });

      const embed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle('♻️ Logs Refreshed Successfully')
        .setDescription('The latest DayZ logs have been pulled, parsed, and summarized.')
        .addFields(
          { name: 'Service ID', value: service_id.toString(), inline: true },
          { name: 'Total Events', value: events.length.toString(), inline: true },
          { name: 'Kills', value: summary.kills.toString(), inline: true },
          { name: 'Deaths', value: summary.deaths.toString(), inline: true },
          { name: 'Connections', value: summary.connections.toString(), inline: true },
          { name: 'Base Events', value: summary.base.toString(), inline: true },
        )
        .setFooter({ text: 'Grizzly Gaming-GG | Log Analyzer Cache Updated' })
        .setTimestamp();

      logger.info(`♻️ Logs refreshed for guild ${guildId} | ${events.length} events parsed`);
      return interaction.editReply({ content: '✅ Log refresh completed.', embeds: [embed] });
    } catch (err) {
      logger.error('❌ Log refresh failed:', err);
      return interaction.editReply({
        content: `❌ **Failed to refresh logs:**\n\`\`\`${err.message}\`\`\``,
      });
    }
  },
};
