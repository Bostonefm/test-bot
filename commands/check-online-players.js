const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { pool } = require('../modules/db');
const { createNitradoAPI } = require('../modules/nitrado');
const { DayZLogAnalyzer } = require('../modules/logAnalyzer');
const logger = require('../modules/logger');
const { decrypt } = require('../utils/encryption');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check-online-players')
    .setDescription('Check currently detected online players from logs')
    .setDefaultMemberPermissions('0'), // Admin only

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 }); // 64 = MessageFlags.Ephemeral

    try {
      const guildId = interaction.guildId;

      // Get Nitrado credentials
      const result = await pool.query(
        'SELECT service_id, encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE guild_id = $1',
        [guildId]
      );

      if (result.rows.length === 0) {
        return interaction.editReply({
          content: '❌ No Nitrado connection found. Use `/register-server` first.',
        });
      }

      const { service_id, encrypted_token, token_iv, auth_tag } = result.rows[0];

      // Decrypt API token
      let api_token;
      try {
        api_token = decrypt(encrypted_token, token_iv, auth_tag);
      } catch (decryptError) {
        return interaction.editReply({
          content: '❌ Failed to decrypt API token. Please reconnect your server.',
        });
      }

      const api = createNitradoAPI(api_token);
      const logAnalyzer = new DayZLogAnalyzer();

      // Get server info first
      let serviceInfo;
      let serverStatus = 'unknown';
      let gameMode = 'unknown';

      try {
        serviceInfo = await api.getServiceInfo(service_id);
        // The getServiceInfo method returns the raw response, so we need to check the data structure
        if (serviceInfo && serviceInfo.data && serviceInfo.data.service) {
          serverStatus = serviceInfo.data.service.status || 'unknown';
          gameMode =
            serviceInfo.data.service.details?.game ||
            serviceInfo.data.service.details?.name ||
            'unknown';
        }
      } catch (serviceError) {
        logger.warn(`Could not get service info: ${serviceError.message}`);
        // Continue with unknown status rather than failing completely
      }

      // Get DayZ path
      const pathResult = await api.findDayzPath(service_id);
      if (!pathResult.success) {
        return interaction.editReply({
          content: '❌ Failed to find DayZ path on server.',
        });
      }

      // Get current players from log analyzer if available
      const currentPlayers = logAnalyzer.getCurrentPlayers(service_id);

      // Try to get recent log activity
      const recentFiles = pathResult.files
        .filter(f => {
          const name = f.name || f.filename;
          return name && (name.endsWith('.RPT') || name.endsWith('.ADM')) && (f.size || 0) > 0;
        })
        .slice(0, 2);

      let logActivity = '';
      let totalLogEvents = 0;

      if (recentFiles.length > 0) {
        for (const file of recentFiles) {
          try {
            const fileName = file.name || file.filename;
            const content = await api.readFileFromPosition(
              service_id,
              `${pathResult.path}/${fileName}`,
              0
            );

            if (content.success && content.content) {
              const events = logAnalyzer.processLogContent
                ? logAnalyzer.processLogContent(content.content, service_id, fileName)
                : [];
              totalLogEvents += events.length;

              // Look for recent player activity
              const recentJoins = events.filter(e => e.type === 'player_join').slice(-5);
              const recentLeaves = events.filter(e => e.type === 'player_leave').slice(-5);
              const recentActivity = events
                .filter(e => ['player_kill', 'chat_message', 'player_position'].includes(e.type))
                .slice(-10);

              if (recentJoins.length > 0) {
                description += `\n**Recent Joins:**\n`;
                recentJoins.forEach(join => {
                  description += `• ${join.player_name} joined\n`;
                });
              }

              if (recentLeaves.length > 0) {
                description += `\n**Recent Leaves:**\n`;
                recentLeaves.forEach(leave => {
                  description += `• ${leave.player_name} left\n`;
                });
              }

              if (recentActivity.length > 0) {
                description += `\n**Recent Activity:** ${recentActivity.length} events\n`;
              }(-10);

              if (recentJoins.length > 0 || recentLeaves.length > 0 || recentActivity.length > 0) {
                logActivity += `\n**${fileName}:**\n`;
                if (recentJoins.length > 0) {
                  logActivity += `• ${recentJoins.length} recent joins\n`;
                }
                if (recentLeaves.length > 0) {
                  logActivity += `• ${recentLeaves.length} recent leaves\n`;
                }
                if (recentActivity.length > 0) {
                  logActivity += `• ${recentActivity.length} recent activities\n`;
                }
              }
            }
          } catch (fileError) {
            logger.warn(`Failed to read ${file.name}: ${fileError.message}`);
          }
        }
      }

      // Create status embed
      const embed = new EmbedBuilder()
        .setTitle('🔍 Online Player Detection Status')
        .setColor(serverStatus === 'started' ? 0x00ff00 : 0xff6600)
        .addFields(
          { name: '🖥️ Server Status', value: serverStatus.toUpperCase(), inline: true },
          { name: '🎮 Game Mode', value: gameMode.toUpperCase(), inline: true },
          { name: '📊 Service ID', value: service_id.toString(), inline: true },
          { name: '📁 Log Files Found', value: recentFiles.length.toString(), inline: true },
          { name: '📝 Total Log Events', value: totalLogEvents.toString(), inline: true },
          { name: '👥 Tracked Players', value: currentPlayers.length.toString(), inline: true }
        )
        .setTimestamp();

      // Add current players if any
      if (currentPlayers.length > 0) {
        const playerList = currentPlayers
          .map(p => `• ${p.name} (${Math.round(p.sessionDuration / 60000)}m)`)
          .join('\n');
        embed.addFields({ name: '🟢 Currently Tracked Players', value: playerList, inline: false });
      }

      // Add recent log activity
      if (logActivity) {
        embed.addFields({
          name: '📈 Recent Log Activity',
          value: logActivity.substring(0, 1000),
          inline: false,
        });
      } else if (totalLogEvents === 0) {
        embed.addFields({
          name: '⚠️ Log Status',
          value: 'No recent events detected. Server may be inactive or logs not updating.',
          inline: false,
        });
      }

      // Add troubleshooting info
      let troubleshooting = '';
      if (serverStatus !== 'started') {
        troubleshooting += '• Server is not started\n';
      }
      if (recentFiles.length === 0) {
        troubleshooting += '• No recent log files found\n';
      }
      if (totalLogEvents === 0) {
        troubleshooting += '• No log events detected\n';
      }
      if (currentPlayers.length === 0 && totalLogEvents > 0) {
        troubleshooting += '• Events detected but no active players tracked\n';
      }

      if (troubleshooting) {
        embed.addFields({ name: '🔧 Potential Issues', value: troubleshooting, inline: false });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Check online players error:', error);
      await interaction.editReply({
        content: `❌ Error checking online players: ${error.message}`,
      });
    }
  },
};
