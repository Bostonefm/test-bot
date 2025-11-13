const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createNitradoAPI, getNitradoToken } = require('../modules/nitrado');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-status')
    .setDescription('Get server status and information')
    .addStringOption(option =>
      option.setName('service_id').setDescription('Nitrado service ID').setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('token')
        .setDescription('Your Nitrado API token (optional if stored)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      const serviceId = interaction.options.getString('service_id');
      const providedToken = interaction.options.getString('token');

      let token;
      if (providedToken) {
        token = providedToken;
      } else {
        try {
          token = await getNitradoToken(guildId, serviceId);
        } catch (error) {
          return await interaction.editReply({
            content:
              '❌ No stored API token found. Please provide a token or store one using `/register-server`.',
            ephemeral: true,
          });
        }
      }

      const api = createNitradoAPI(token);

      // Get multiple pieces of information
      const [serviceInfo, gameserverInfo, statusInfo] = await Promise.allSettled([
        api.getService(serviceId),
        api.getGameserver(serviceId),
        api.getGameserverStatus(serviceId),
      ]);

      const embed = new EmbedBuilder()
        .setTitle(`🎮 Server Status: ${serviceId}`)
        .setColor('#00ff00')
        .setTimestamp();

      // Service Information
      if (serviceInfo.status === 'fulfilled') {
        const service = serviceInfo.value.data?.service;
        if (service) {
          embed.addFields({
            name: '📋 Service Information',
            value:
              `**Name:** ${service.details?.name || 'N/A'}\n` +
              `**Status:** ${service.status}\n` +
              `**Type:** ${service.type}\n` +
              `**Location:** ${service.location?.country || 'N/A'}`,
            inline: true,
          });
        }
      }

      // Gameserver Information
      if (gameserverInfo.status === 'fulfilled') {
        const gameserver = gameserverInfo.value.data?.gameserver;
        if (gameserver) {
          embed.addFields({
            name: '🎯 Game Server',
            value:
              `**Game:** ${gameserver.game || 'N/A'}\n` +
              `**Slots:** ${gameserver.slots || 'N/A'}\n` +
              `**IP:** ${gameserver.ip || 'N/A'}\n` +
              `**Port:** ${gameserver.port || 'N/A'}`,
            inline: true,
          });
        }
      }

      // Status Information
      if (statusInfo.status === 'fulfilled') {
        const status = statusInfo.value.data?.status;
        if (status) {
          const statusEmoji = status === 'started' ? '🟢' : status === 'stopped' ? '🔴' : '🟡';

          embed.addFields({
            name: '⚡ Server Status',
            value:
              `${statusEmoji} **${status?.toUpperCase() || 'UNKNOWN'}**\n` +
              `**CPU:** ${statusInfo.value.data?.cpu || 'N/A'}%\n` +
              `**Memory:** ${statusInfo.value.data?.memory || 'N/A'}%\n` +
              `**Query:** ${statusInfo.value.data?.query?.status || 'N/A'}`,
            inline: true,
          });
        }
      }

      // Try to get player information
      try {
        const playersResponse = await api.getPlayers(serviceId);
        const players = playersResponse?.data?.players || [];

        embed.addFields({
          name: '👥 Players Online',
          value:
            `**Count:** ${players.length}\n` +
            (players.length > 0
              ? `**Players:** ${players
                  .slice(0, 3)
                  .map(p => p.name)
                  .join(', ')}${players.length > 3 ? '...' : ''}`
              : '**Players:** None'),
          inline: false,
        });
      } catch (playerError) {
        // Player info is optional, don't fail the whole command
        embed.addFields({
          name: '👥 Players Online',
          value: 'Unable to retrieve player information',
          inline: false,
        });
      }

      // Add any error information
      const errors = [];
      if (serviceInfo.status === 'rejected') {
        errors.push('Service Info');
      }
      if (gameserverInfo.status === 'rejected') {
        errors.push('Gameserver Info');
      }
      if (statusInfo.status === 'rejected') {
        errors.push('Status Info');
      }

      if (errors.length > 0) {
        embed.setFooter({ text: `⚠️ Some information unavailable: ${errors.join(', ')}` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Server status error:', error);
      await interaction.editReply({
        content: `❌ Failed to get server status: ${error.message}`,
      });
    }
  },
};
