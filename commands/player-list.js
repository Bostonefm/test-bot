const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createNitradoAPI, getNitradoToken } = require('../modules/nitrado');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('player-list')
    .setDescription('Get current player list from the server')
    .addStringOption(option =>
      option.setName('service_id').setDescription('Nitrado service ID').setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('token')
        .setDescription('Your Nitrado API token (optional if stored)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions('0'), // Admin only

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
      const playersResponse = await api.getPlayers(serviceId);

      const players = playersResponse?.data?.players || [];

      const embed = new EmbedBuilder()
        .setTitle(`👥 Players Online - Service ${serviceId}`)
        .setColor(players.length > 0 ? '#00ff00' : '#ffaa00')
        .setTimestamp();

      if (players.length === 0) {
        embed.setDescription('🏜️ No players currently online');
      } else {
        // Sort players by name
        players.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Create player list
        const playerList = players
          .map((player, index) => {
            const name = player.name || 'Unknown';
            const online_time = player.online_time
              ? `(${Math.floor(player.online_time / 60)}m)`
              : '';
            const ping = player.ping ? `${player.ping}ms` : '';

            return `**${index + 1}.** ${name} ${online_time} ${ping}`.trim();
          })
          .join('\n');

        // Split into multiple fields if too long
        if (playerList.length <= 1024) {
          embed.addFields({
            name: `🎮 Players (${players.length})`,
            value: playerList,
            inline: false,
          });
        } else {
          // Split into chunks
          const chunks = [];
          const lines = playerList.split('\n');
          let currentChunk = '';

          for (const line of lines) {
            if ((currentChunk + line + '\n').length > 1024) {
              if (currentChunk) {
                chunks.push(currentChunk.trim());
              }
              currentChunk = line + '\n';
            } else {
              currentChunk += line + '\n';
            }
          }
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }

          chunks.forEach((chunk, index) => {
            embed.addFields({
              name: index === 0 ? `🎮 Players (${players.length})` : `🎮 Players (continued)`,
              value: chunk,
              inline: false,
            });
          });
        }

        // Add summary statistics
        const totalOnlineTime = players.reduce((sum, p) => sum + (p.online_time || 0), 0);
        const avgOnlineTime =
          players.length > 0 ? Math.floor(totalOnlineTime / players.length / 60) : 0;
        const avgPing =
          players.filter(p => p.ping).length > 0
            ? Math.floor(
                players.filter(p => p.ping).reduce((sum, p) => sum + p.ping, 0) /
                  players.filter(p => p.ping).length
              )
            : 0;

        embed.addFields({
          name: '📊 Statistics',
          value:
            `**Average Session:** ${avgOnlineTime}m\n` +
            `**Average Ping:** ${avgPing}ms\n` +
            `**Total Online Time:** ${Math.floor(totalOnlineTime / 60)}m`,
          inline: true,
        });
      }

      embed.setFooter({ text: `🔄 Updated` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Player list error:', error);
      await interaction.editReply({
        content: `❌ Failed to get player list: ${error.message}`,
      });
    }
  },
};
