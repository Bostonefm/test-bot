
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { logMonitoringManager } = require('../modules/logMonitoringManager');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monitoring-status')
    .setDescription('Check the status of log monitoring for your server'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const status = logMonitoringManager.getMonitoringStatus(guildId);

      const embed = new EmbedBuilder()
        .setTitle('📊 Log Monitoring Status')
        .setTimestamp();

      if (!status.isActive) {
        embed.setColor('#ff0000')
          .setDescription('❌ **No active monitoring**\n\nUse `/start-monitoring` to begin monitoring your server logs.');
      } else {
        const uptimeHours = Math.floor(status.uptime / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((status.uptime % (1000 * 60 * 60)) / (1000 * 60));

        embed.setColor('#00ff00')
          .addFields(
            {
              name: '🎯 Service Information',
              value: `**Service ID:** ${status.serviceId}\n**Status:** Active ✅`,
              inline: true
            },
            {
              name: '📁 Monitoring Paths',
              value: status.paths.map(p => `• ${p}`).join('\n') || 'None configured',
              inline: false
            },
            {
              name: '📊 Statistics',
              value: `**Events Processed:** ${status.eventsProcessed}\n**Tracked Files:** ${status.trackedFiles}\n**Check Interval:** ${Math.round(status.interval / 60000)} minutes`,
              inline: true
            },
            {
              name: '⏱️ Runtime',
              value: `**Uptime:** ${uptimeHours}h ${uptimeMinutes}m\n**Last Check:** <t:${Math.floor(status.lastCheck / 1000)}:R>`,
              inline: true
            }
          );
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Monitoring status error:', error);
      await interaction.editReply({
        content: `❌ **Error checking status:**\n\`\`\`\n${error.message}\n\`\`\``
      });
    }
  }
};
