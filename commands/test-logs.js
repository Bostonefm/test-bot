const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getPool } = require('../modules/db');
const { createNitradoAPI } = require('../modules/nitrado');
const { DayZLogAnalyzer } = require('../modules/logAnalyzer');
const { DiscordNotificationSystem } = require('../modules/discordNotifications');
const logger = require('../config/logger');
const { decrypt } = require('../utils/encryption');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-logs')
    .setDescription('🧪 Run a live test of DayZ log analysis and notifications.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const pool = getPool();

      // 🔐 Get Nitrado credentials
      const { rows } = await pool.query(
        `SELECT service_id, encrypted_token, token_iv, auth_tag
         FROM nitrado_credentials
         WHERE guild_id = $1 AND service_id IS NOT NULL
         LIMIT 1`,
        [guildId]
      );

      if (!rows.length) {
        return interaction.editReply('❌ No active Nitrado connection found for this guild.');
      }

      const { service_id, encrypted_token, token_iv, auth_tag } = rows[0];
      const decryptedToken = decrypt(encrypted_token, token_iv, auth_tag);
      const nitrado = createNitradoAPI(decryptedToken);

      const analyzer = new DayZLogAnalyzer();
      const notifier = new DiscordNotificationSystem(interaction.client);

      await interaction.editReply('🔍 Fetching latest logs from Nitrado...');

      // 🧾 Pull and analyze logs directly
      const logs = await analyzer.fetchRecentLogs(service_id, 3);
      if (!logs.length) {
        return interaction.editReply('⚠️ No logs retrieved from Nitrado. Try again later.');
      }

      const events = [];
      for (const line of logs) {
        const parsed = analyzer.parseLogEntry(line, service_id);
        if (parsed) events.push(parsed);
      }

      logger.info(`🧪 Test log scan: ${events.length} events detected for guild ${guildId}`);

      // 🔔 Test notifications (first few)
      const testEvents = events.slice(0, 3);
      if (testEvents.length) await notifier.processEvents(testEvents, guildId);

      // 📊 Build summary embed
      const summary = analyzer.generateSummary ? await analyzer.generateSummary(service_id) : {};
      const eventTypes = [...new Set(events.map(e => e.type))].slice(0, 10);

      const embed = new EmbedBuilder()
        .setColor(0x03a9f4)
        .setTitle('🧪 Log Analyzer Test Results')
        .setDescription('This confirms your Nitrado → Analyzer → Discord pipeline is working.')
        .addFields(
          { name: 'Service ID', value: service_id.toString(), inline: true },
          { name: 'Events Found', value: events.length.toString(), inline: true },
          { name: 'Unique Types', value: eventTypes.join(', ') || 'None', inline: false },
          { name: 'Summary', value: `Kills: ${summary.kills || 0} | Deaths: ${summary.deaths || 0} | Connections: ${summary.connections || 0}`, inline: false },
        )
        .setFooter({ text: 'Grizzly Gaming-GG | Diagnostic Mode' })
        .setTimestamp();

      return interaction.editReply({ content: '✅ Log test completed successfully.', embeds: [embed] });
    } catch (err) {
      logger.error('❌ /test-logs failed:', err);
      return interaction.editReply({
        content: `❌ **Error while testing logs:**\n\`\`\`${err.message}\`\`\``,
      });
    }
  },
};
