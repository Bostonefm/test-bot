const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streaming-status')
    .setDescription('Check the status of continuous log monitoring'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Check if Polling Monitor is available
      const pollingMonitor = interaction.client.nitradoPollingMonitor;
      if (!pollingMonitor) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Polling Monitor Unavailable')
          .setDescription('Polling monitor is not initialized. Please restart the bot.')
          .setTimestamp();

        return interaction.editReply({ embeds: [errorEmbed] });
      }

      const guildId = interaction.guild.id;

      // Get Nitrado credentials
      const { db } = require('../modules/db');
      const result = await db.query(
        'SELECT service_id FROM nitrado_credentials WHERE guild_id = $1 AND service_id IS NOT NULL',
        [guildId]
      );

      if (result.rows.length === 0) {
        return interaction.editReply({
          content: '❌ No server registration found. Use `/register-server` first.',
        });
      }

      const { service_id } = result.rows[0];

      // Get polling status from the monitor
      let connections = {};
      try {
        connections = pollingMonitor.getAllConnections() || {};
      } catch (monitorError) {
        logger.error('Error getting connections:', monitorError);
        connections = {};
      }

      // Check if service is being monitored
      const serviceConnection = connections[service_id];

      if (!serviceConnection || !serviceConnection.connected) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('🔴 Monitoring Status')
          .setDescription(`No active monitoring for service **${service_id}**`)
          .addFields(
            { name: '📊 Status', value: 'Inactive', inline: true },
            { name: '💡 Action', value: 'Use `/start-monitoring` to begin', inline: true },
            { name: '🔄 Monitor Type', value: 'Polling (5 min intervals)', inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // Calculate activity metrics
      const lastPull = serviceConnection.lastPull ? new Date(serviceConnection.lastPull) : null;
      const lastPullAgo = lastPull
        ? Math.round((Date.now() - lastPull.getTime()) / (60 * 1000))
        : 0;

      // Determine status color based on polling activity
      let color = '#00ff00'; // Green - active
      if (lastPullAgo > 10) {
        color = '#ffaa00';
      } // Orange - warning
      if (lastPullAgo > 30) {
        color = '#ff6b6b';
      } // Red - concerning

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('📊 Polling Monitor Status')
        .setDescription(`Log monitoring active for service **${service_id}**`)
        .addFields(
          { name: '📊 Status', value: 'Active & Polling', inline: true },
          { name: '📡 Channel', value: `<#${serviceConnection.channelId}>`, inline: true },
          { name: '🔄 Poll Interval', value: '5 minutes', inline: true },
          {
            name: '📁 Files Monitored',
            value: `${serviceConnection.filesMonitored || 0}`,
            inline: true,
          },
          {
            name: '🕒 Last Poll',
            value: lastPull ? `${lastPullAgo} min ago` : 'Never',
            inline: true,
          },
          { name: '📂 Target Files', value: 'Latest ADM & RPT', inline: true }
        )
        .setFooter({ text: 'Polling-based monitoring (checks every 5 minutes)' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Streaming status error:', error);
      await interaction.editReply({
        content: `❌ Failed to get monitoring status: ${error.message}`,
      });
    }
  },
};
