const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ConfigFileMonitor } = require('../modules/configFileMonitor');
const logger = require('../utils/logger');

// Global monitor instance
let configMonitor = null;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start-config-monitor')
    .setDescription('Start monitoring and downloading latest ADM/RPT config files')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Monitor action')
        .setRequired(true)
        .addChoices(
          { name: 'Start Monitoring', value: 'start' },
          { name: 'Stop Monitoring', value: 'stop' },
          { name: 'Check Status', value: 'status' },
          { name: 'Recent Downloads', value: 'downloads' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const action = interaction.options.getString('action');

      // Initialize monitor if not exists
      if (!configMonitor) {
        configMonitor = new ConfigFileMonitor();
      }

      switch (action) {
        case 'start':
          if (configMonitor.getStatus().isRunning) {
            await interaction.editReply({
              content:
                '⚠️ **Config monitoring is already running**\n\nUse `/start-config-monitor status` to check current status.',
            });
            return;
          }

          await configMonitor.startMonitoring();

          const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Config Monitoring Started')
            .setDescription(
              '🔍 **Config file monitoring is now active**\n\n' +
              '📂 **Monitoring ADM and RPT files**\n' +
              '⏰ **Check interval:** 5 minutes\n' +
              '📁 **Download location:** `/downloads`\n\n' +
              'Use `/start-config-monitor status` to check monitoring status.'
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          break;

        case 'stop':
          if (!configMonitor.getStatus().isRunning) {
            await interaction.editReply({
              content: '⚠️ **Config monitoring is not running**',
            });
            return;
          }

          configMonitor.stopMonitoring();

          await interaction.editReply({
            content: '🛑 **Config monitoring stopped**\n\nUse `/start-config-monitor start` to restart monitoring.',
          });
          break;

        case 'status':
          const status = configMonitor.getStatus();
          
          const statusEmbed = new EmbedBuilder()
            .setColor(status.isRunning ? '#00FF00' : '#FF0000')
            .setTitle('📊 Config Monitoring Status')
            .addFields(
              { name: '🔍 Status', value: status.isRunning ? 'Running' : 'Stopped', inline: true },
              { name: '⏰ Check Interval', value: '5 minutes', inline: true },
              { name: '📁 Downloads Path', value: '/downloads', inline: true },
              { name: '📊 Last Check', value: status.lastCheck || 'Never', inline: true },
              { name: '📄 Files Downloaded', value: status.filesDownloaded?.toString() || '0', inline: true }
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [statusEmbed] });
          break;

        case 'downloads':
          const recentDownloads = configMonitor.getRecentDownloads();
          
          let downloadsDescription = '📥 **Recent Downloads:**\n\n';
          
          if (recentDownloads.length === 0) {
            downloadsDescription += 'No recent downloads found.';
          } else {
            recentDownloads.slice(0, 10).forEach((download, index) => {
              downloadsDescription += `${index + 1}. **${download.fileName}**\n`;
              downloadsDescription += `   📁 ${download.path}\n`;
              downloadsDescription += `   📊 ${download.size} bytes\n`;
              downloadsDescription += `   🕒 ${download.downloadTime}\n\n`;
            });
          }

          const downloadsEmbed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('📥 Recent Config Downloads')
            .setDescription(downloadsDescription)
            .setTimestamp();

          await interaction.editReply({ embeds: [downloadsEmbed] });
          break;

        default:
          await interaction.editReply({
            content: '❌ Invalid action specified.',
          });
      }
    } catch (error) {
      logger.error('Start config monitor command error:', error);
      
      await interaction.editReply({
        content: '❌ **Error with config monitoring**\n\nPlease check the logs for more details.',
      });
    }
  },
};
