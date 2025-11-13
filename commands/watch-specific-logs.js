const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { specificLogWatcher } = require('../modules/specificLogWatcher');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('watch-specific-logs')
    .setDescription('Watch PlayStation DayZ logs from /games/ni8504127_1/noftp/dayzps/config')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start watching for PlayStation DayZ log updates')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('stop').setDescription('Stop watching for log updates')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('status').setDescription('Check watcher status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('interval')
        .setDescription('Set check interval')
        .addIntegerOption(option =>
          option
            .setName('seconds')
            .setDescription('Check interval in seconds (minimum 5)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('check').setDescription('Force check for updates now')
    )
    .setDefaultMemberPermissions('0'), // Admin only

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'start':
          const guildId = interaction.guildId;

          logger.info(`🎯 Starting PlayStation DayZ log watcher for confirmed path`);

          const startResult = await specificLogWatcher.startWatching(
            '12326241', // Your confirmed service ID
            guildId,
            interaction.client
          );

          if (startResult.success) {
            const embed = new EmbedBuilder()
              .setTitle('🎯 PlayStation DayZ Log Watcher Started')
              .setColor('#00ff00')
              .addFields(
                { name: '📁 Path', value: startResult.path, inline: false },
                { name: '📊 Service ID', value: '12326241', inline: true },
                {
                  name: '📋 DayZ Log Files',
                  value: startResult.initialFiles.toString(),
                  inline: true,
                },
                {
                  name: '📄 Total Files',
                  value: startResult.totalFiles?.toString() || 'Unknown',
                  inline: true,
                },
                { name: '⏱️ Check Interval', value: '15 seconds', inline: true }
              )
              .setTimestamp()
              .setFooter({ text: 'Monitoring PlayStation DayZ server logs' });

            await interaction.editReply({ embeds: [embed] });
          } else {
            await interaction.editReply({
              content: `❌ **Failed to start PlayStation DayZ log watcher:**\n\`\`\`\n${startResult.error || startResult.message}\n\`\`\``,
            });
          }
          break;

        case 'stop':
          const stopResult = specificLogWatcher.stopWatching();

          if (stopResult.success) {
            await interaction.editReply({
              content: '🛑 **PlayStation DayZ log watcher stopped**',
            });
          } else {
            await interaction.editReply({
              content: `❌ **Failed to stop watcher:**\n\`\`\`\n${stopResult.error}\n\`\`\``,
            });
          }
          break;

        case 'status':
          const status = specificLogWatcher.getStatus();
          const trackingInfo = specificLogWatcher.getFileTrackingInfo();

          const embed = new EmbedBuilder()
            .setColor(status.isRunning ? '#00ff00' : '#ff0000')
            .setTitle('🎯 Specific Log Watcher Status')
            .addFields(
              { name: '🔄 Status', value: status.isRunning ? '✅ Running' : '❌ Stopped', inline: true },
              { name: '📁 Path', value: status.path, inline: false },
              { name: '🆔 Service ID', value: status.serviceId, inline: true },
              { name: '📄 Tracked Files', value: status.trackedFiles.toString(), inline: true },
              { name: '⏱️ Check Interval', value: `${Math.round(status.checkInterval / 1000)}s (${Math.round(status.checkInterval / 60000)} min)`, inline: true }
            );

          if (status.lastCheck) {
            const lastCheckTime = new Date(status.lastCheck);
            embed.addFields({ 
              name: '🕒 Last Check', 
              value: `<t:${Math.floor(lastCheckTime.getTime() / 1000)}:R>`, 
              inline: true 
            });
          }

          // Add detailed file tracking information
          if (Object.keys(trackingInfo).length > 0) {
            let trackingDetails = '';
            for (const [fileName, info] of Object.entries(trackingInfo)) {
              trackingDetails += `**${fileName}**\n`;
              trackingDetails += `├ Size: ${info.size}\n`;
              trackingDetails += `├ Modified: ${info.lastModified}\n`;
              trackingDetails += `├ Processed: ${info.totalProcessed}\n`;
              trackingDetails += `└ Hash: ${info.contentHash}\n\n`;
            }

            if (trackingDetails.length > 1024) {
              trackingDetails = trackingDetails.substring(0, 1000) + '...\n*(truncated)*';
            }

            embed.addFields({ 
              name: '📋 File Tracking Details', 
              value: trackingDetails || 'No files tracked yet', 
              inline: false 
            });
          }

          await interaction.editReply({ embeds: [embed] });
          break;

        case 'interval':
          const seconds = interaction.options.getInteger('seconds');

          if (seconds < 5) {
            await interaction.editReply({
              content: '❌ **Minimum interval is 5 seconds**',
            });
            return;
          }

          specificLogWatcher.setCheckInterval(seconds * 1000);

          await interaction.editReply({
            content: `✅ **PlayStation DayZ log check interval updated to ${seconds} seconds**`,
          });
          break;

        case 'check':
          const checkResult = await specificLogWatcher.forceCheck();

          if (checkResult.success) {
            await interaction.editReply({
              content: '✅ **Force check completed successfully**',
            });
          } else {
            await interaction.editReply({
              content: `❌ **Force check failed:**\n\`\`\`\n${checkResult.message}\n\`\`\``,
            });
          }
          break;

        default:
          await interaction.editReply({
            content: '❌ **Unknown subcommand**',
          });
          break;
      }
    } catch (error) {
      logger.error('Watch specific logs command error:', error);

      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: `❌ **Command failed:**\n\`\`\`\n${error.message}\n\`\`\``,
          });
        } else if (!interaction.replied) {
          await interaction.reply({
            content: `❌ **Command failed:**\n\`\`\`\n${error.message}\n\`\`\``,
            ephemeral: true,
          });
        }
      } catch (responseError) {
        logger.error('Failed to send error response:', responseError);
      }
    }
  },
};
