const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createNitradoAPI, getNitradoToken } = require('../modules/nitrado');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-services')
    .setDescription('List your Nitrado services')
    .addStringOption(option =>
      option
        .setName('token')
        .setDescription('Your Nitrado API token (optional if stored)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const providedToken = interaction.options.getString('token');

      let token;
      if (providedToken) {
        token = providedToken;
      } else {
        try {
          token = await getNitradoToken(guildId);
        } catch (error) {
          return await interaction.editReply({
            content:
              '❌ No stored API token found. Please provide a token or store one using `/register-server`.',
            ephemeral: true,
          });
        }
      }

      const api = createNitradoAPI(token);
      const servicesResponse = await api.getServices();

      if (!servicesResponse?.data?.services || servicesResponse.data.services.length === 0) {
        return await interaction.editReply({
          content: '📭 No services found on your Nitrado account.',
          ephemeral: true,
        });
      }

      const services = servicesResponse.data.services;

      const embed = new EmbedBuilder()
        .setTitle('🎮 Your Nitrado Services')
        .setColor('#00ff00')
        .setTimestamp();

      // Group services by type
      const gameservers = services.filter(s => s.type === 'Gameserver');
      const otherServices = services.filter(s => s.type !== 'Gameserver');

      if (gameservers.length > 0) {
        const gameserverList = gameservers
          .map(service => {
            const status =
              service.status === 'installed' ? '🟢' : service.status === 'suspended' ? '🔴' : '🟡';
            return (
              `${status} **${service.details?.name || service.id}** (ID: ${service.id})\n` +
              `   └ ${service.details?.game || 'Unknown Game'} - ${service.status}`
            );
          })
          .join('\n');

        embed.addFields({
          name: `🎮 Game Servers (${gameservers.length})`,
          value:
            gameserverList.length > 1024
              ? gameserverList.substring(0, 1021) + '...'
              : gameserverList,
          inline: false,
        });
      }

      if (otherServices.length > 0) {
        const otherList = otherServices
          .map(service => {
            const status =
              service.status === 'installed' ? '🟢' : service.status === 'suspended' ? '🔴' : '🟡';
            return `${status} **${service.type}** (ID: ${service.id}) - ${service.status}`;
          })
          .join('\n');

        embed.addFields({
          name: `🔧 Other Services (${otherServices.length})`,
          value: otherList.length > 1024 ? otherList.substring(0, 1021) + '...' : otherList,
          inline: false,
        });
      }

      embed.setFooter({ text: `Total Services: ${services.length}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('List services error:', error);
      await interaction.editReply({
        content: `❌ Failed to list services: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
