const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createNitradoAPI } = require('../modules/nitrado');
const { pool } = require('../modules/db');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nitrado-logs')
    .setDescription('View Nitrado system logs for your server')
    .addIntegerOption(option =>
      option
        .setName('hours')
        .setDescription('Number of hours of logs to retrieve (default: 24)')
        .setMinValue(1)
        .setMaxValue(168) // 1 week max
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Filter by log category')
        .addChoices(
          { name: 'Server', value: 'server' },
          { name: 'Admin', value: 'admin' },
          { name: 'System', value: 'system' },
          { name: 'All', value: 'all' }
        )
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('severity')
        .setDescription('Filter by severity level')
        .addChoices(
          { name: 'Info', value: 'info' },
          { name: 'Warning', value: 'warning' },
          { name: 'Error', value: 'error' },
          { name: 'All', value: 'all' }
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions('0'), // Admin only

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      const hours = interaction.options.getInteger('hours') || 24;
      const categoryFilter = interaction.options.getString('category') || 'all';
      const severityFilter = interaction.options.getString('severity') || 'all';

      // Get Nitrado credentials
      const result = await pool.query(
        'SELECT service_id, encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE guild_id = $1 AND service_id IS NOT NULL',
        [guildId]
      );

      if (result.rows.length === 0) {
        return interaction.editReply({
          content: '❌ No Nitrado connection found. Use `/register-server` first.',
        });
      }

      const { service_id, encrypted_token, token_iv, auth_tag } = result.rows[0];

      // Decrypt token
      const { decrypt } = require('../utils/encryption');
      const decryptedToken = decrypt(encrypted_token, token_iv, auth_tag);

      const api = createNitradoAPI(decryptedToken);

      await interaction.editReply({
        content: `🔍 Fetching Nitrado system logs (last ${hours} hours)...`,
      });

      // Get logs from Nitrado API
      const logsResponse = await api.getLogs(service_id, hours);

      if (!logsResponse.data || !logsResponse.data.logs) {
        return interaction.editReply({
          content: '❌ No logs found or invalid response from Nitrado API.',
        });
      }

      let logs = logsResponse.data.logs;

      // Apply filters
      if (categoryFilter !== 'all') {
        logs = logs.filter(log => log.category === categoryFilter);
      }

      if (severityFilter !== 'all') {
        logs = logs.filter(log => log.severity === severityFilter);
      }

      // Sort by most recent first
      logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Create summary statistics
      const totalLogs = logsResponse.data.log_count;
      const filteredLogs = logs.length;
      const categories = {};
      const severities = {};

      logs.forEach(log => {
        categories[log.category] = (categories[log.category] || 0) + 1;
        severities[log.severity] = (severities[log.severity] || 0) + 1;
      });

      // Create main embed
      const embed = new EmbedBuilder()
        .setTitle('📋 Nitrado System Logs')
        .setColor('#00FF00')
        .setTimestamp();

      // Add summary
      embed.addFields({
        name: '📊 Summary',
        value: `**Total Logs:** ${totalLogs}\n**Filtered Results:** ${filteredLogs}\n**Time Range:** Last ${hours} hours\n**Service ID:** ${service_id}`,
        inline: false,
      });

      // Add category breakdown
      if (Object.keys(categories).length > 0) {
        const categoryBreakdown = Object.entries(categories)
          .map(([cat, count]) => `${cat}: ${count}`)
          .join('\n');

        embed.addFields({
          name: '📂 Categories',
          value: categoryBreakdown,
          inline: true,
        });
      }

      // Add severity breakdown
      if (Object.keys(severities).length > 0) {
        const severityBreakdown = Object.entries(severities)
          .map(([sev, count]) => {
            const emoji = sev === 'error' ? '🔴' : sev === 'warning' ? '🟡' : '🟢';
            return `${emoji} ${sev}: ${count}`;
          })
          .join('\n');

        embed.addFields({
          name: '⚠️ Severity',
          value: severityBreakdown,
          inline: true,
        });
      }

      // Add recent logs (last 5)
      const recentLogs = logs.slice(0, 5);
      if (recentLogs.length > 0) {
        const recentLogText = recentLogs
          .map(log => {
            const emoji =
              log.severity === 'error' ? '🔴' : log.severity === 'warning' ? '🟡' : '🟢';
            const time = new Date(log.created_at).toLocaleString();
            const adminBadge = log.admin ? '👑' : '';
            return `${emoji} **${time}** ${adminBadge}\n\`${log.category}\` - ${log.message}`;
          })
          .join('\n\n');

        embed.addFields({
          name: '📝 Recent Logs',
          value:
            recentLogText.length > 1024 ? recentLogText.substring(0, 1021) + '...' : recentLogText,
          inline: false,
        });
      }

      // Check for server restarts in the logs
      const restartLogs = logs.filter(log => log.message.toLowerCase().includes('restart'));
      if (restartLogs.length > 0) {
        embed.addFields({
          name: '🔄 Server Restarts',
          value: `${restartLogs.length} restart events found in the last ${hours} hours`,
          inline: true,
        });
      }

      // Check for admin actions
      const adminLogs = logs.filter(log => log.admin === true);
      if (adminLogs.length > 0) {
        embed.addFields({
          name: '👑 Admin Actions',
          value: `${adminLogs.length} admin actions logged`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Log the successful fetch
      logger.info(
        `📋 Fetched ${filteredLogs} Nitrado system logs for guild ${guildId}, service ${service_id}`
      );
    } catch (error) {
      logger.error('Nitrado logs command error:', error);
      await interaction.editReply({
        content: `❌ Error fetching Nitrado logs: ${error.message}`,
      });
    }
  },
};
