const { SlashCommandBuilder } = require('discord.js');
const { pool } = require('../modules/db');
const { createNitradoAPI } = require('../modules/nitrado');
const { DayZLogAnalyzer } = require('../modules/logAnalyzer');
const logger = require('../modules/logger');

const logAnalyzer = new DayZLogAnalyzer();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-report')
    .setDescription('Generate a comprehensive server activity report')
    .addStringOption(option =>
      option
        .setName('period')
        .setDescription('Report period')
        .setRequired(false)
        .addChoices(
          { name: 'Last Hour', value: 'hour' },
          { name: 'Last 24 Hours', value: 'day' },
          { name: 'Last Week', value: 'week' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const period = interaction.options.getString('period') || 'day';

      // Get user's Nitrado credentials
      const result = await pool.query(
        'SELECT encrypted_token, token_iv, auth_tag, service_id FROM nitrado_creds WHERE discord_id = $1',
        [userId]
      );

      const creds = result.rows[0];

      if (!creds) {
        return interaction.editReply({
          content: '⚠️ You need to link your Nitrado account first using `/connect-nitrado`.',
        });
      }

      // Reconstruct token for decryption
      let api_token = creds.encrypted_token;
      if (creds.token_iv && creds.auth_tag) {
        api_token = {
          encrypted: creds.encrypted_token,
          iv: creds.token_iv,
          authTag: creds.auth_tag,
        };
      }
      const { service_id } = creds;

      const api = createNitradoAPI(api_token);

      // Get log files and analyze recent activity
      const pathResult = await api.findDayzPath(service_id);
      const logFiles = pathResult.files.filter(
        f =>
          (f.name || f.filename) &&
          ((f.name || f.filename).endsWith('.RPT') ||
            (f.name || f.filename).endsWith('.ADM') ||
            (f.name || f.filename).endsWith('.log'))
      );

      const allEvents = [];

      // Process recent log files
      for (const logFile of logFiles.slice(0, 5)) {
        try {
          const fileName = logFile.name || logFile.filename;
          const filePath = `${pathResult.path}/${fileName}`;

          const fileContent = await api.downloadFile(service_id, filePath);
          const events = await logAnalyzer.processLogContent(fileContent, service_id, fileName);
          allEvents.push(...events);
        } catch (logError) {
          logger.warn(`Failed to process log file: ${logError.message}`);
        }
      }

      // Filter events by period
      const now = new Date();
      let filterTime;
      switch (period) {
        case 'hour':
          filterTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'week':
          filterTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default: // day
          filterTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const filteredEvents = allEvents.filter(event => event.timestamp >= filterTime);
      const stats = logAnalyzer.generateServerStats(filteredEvents, service_id);
      const healthIssues = logAnalyzer.analyzeServerHealth(filteredEvents, service_id);
      const currentPlayers = logAnalyzer.getCurrentPlayers(service_id);

      // Generate performance trend
      const performanceData = {
        averageSessionTime: 0,
        playerRetention: 0,
        serverStability: 'Good',
      };

      if (stats.playerJoins > 0) {
        performanceData.playerRetention = Math.round(
          ((stats.playerJoins - stats.playerLeaves) / stats.playerJoins) * 100
        );
      }

      if (stats.serverRestarts > 2) {
        performanceData.serverStability = 'Poor';
      } else if (stats.serverRestarts > 0) {
        performanceData.serverStability = 'Fair';
      }

      const embed = {
        color: healthIssues.length > 0 ? 0xff6600 : 0x00aa00,
        title: `📊 Server Report - ${period.charAt(0).toUpperCase() + period.slice(1)}`,
        description: `Comprehensive activity report for the last ${period}`,
        fields: [
          {
            name: '👥 Player Activity',
            value: `**${stats.playerJoins}** joins\n**${stats.uniquePlayers.size}** unique players\n**${currentPlayers.length}** currently online`,
            inline: true,
          },
          {
            name: '⚔️ Combat Stats',
            value: `**${stats.kills}** total kills\n**${Math.round(stats.kills / Math.max(stats.uniquePlayers.size, 1))}** avg kills per player`,
            inline: true,
          },
          {
            name: '💬 Communication',
            value: `**${stats.chatMessages}** chat messages\n**${Math.round(stats.chatMessages / Math.max(stats.uniquePlayers.size, 1))}** avg per player`,
            inline: true,
          },
          {
            name: '🔧 Server Health',
            value: `**${stats.serverRestarts}** restarts\n**${stats.warnings}** warnings\n**${performanceData.serverStability}** stability`,
            inline: true,
          },
          {
            name: '📈 Performance',
            value: `**${stats.peakPlayers}** peak players\n**${performanceData.playerRetention}%** retention rate`,
            inline: true,
          },
          {
            name: '⚠️ Issues',
            value:
              healthIssues.length > 0 ? `**${healthIssues.length}** detected` : '**None** detected',
            inline: true,
          },
        ],
        footer: {
          text: `Service ID: ${service_id} | Generated at`,
        },
        timestamp: new Date().toISOString(),
      };

      // Add health issues if any
      if (healthIssues.length > 0) {
        const issuesList = healthIssues.map(issue => `• ${issue.message}`).join('\n');
        embed.fields.push({
          name: '🚨 Health Issues',
          value: issuesList.substring(0, 1024),
          inline: false,
        });
      }

      // Add top players if available
      const playerActivityMap = new Map();
      filteredEvents
        .filter(e => e.type === 'player_join')
        .forEach(e => {
          playerActivityMap.set(e.playerName, (playerActivityMap.get(e.playerName) || 0) + 1);
        });

      if (playerActivityMap.size > 0) {
        const topPlayers = Array.from(playerActivityMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => `• **${name}** - ${count} sessions`)
          .join('\n');

        embed.fields.push({
          name: '🏆 Most Active Players',
          value: topPlayers,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Server report error:', error);
      await interaction.editReply({
        content: '❌ Failed to generate server report.',
      });
    }
  },
};
