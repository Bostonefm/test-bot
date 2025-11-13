const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getServerDetails, getOnlinePlayers } = require('../services/nitradoServerInfo');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-info')
    .setDescription('Get detailed info about your DayZ server (map, players, status)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Get Nitrado credentials
      const credResult = await db.query(
        `SELECT service_id, access_token, map_name FROM nitrado_credentials WHERE guild_id = $1`,
        [interaction.guildId]
      );

      if (credResult.rows.length === 0) {
        return interaction.editReply({
          content: '❌ No Nitrado server linked to this Discord. Use `/setup-nitrado` first.',
          ephemeral: true
        });
      }

      const { service_id, access_token, map_name } = credResult.rows[0];

      // Fetch server details from Nitrado API
      const serverInfo = await getServerDetails(service_id, access_token);
      const onlinePlayers = await getOnlinePlayers(service_id, access_token);

      // Update map name in database if detected
      if (serverInfo.mapName) {
        let detectedMap = serverInfo.mapName.toLowerCase();
        
        // Normalize map name
        if (detectedMap.includes('chernarus') || detectedMap.includes('enoch')) {
          detectedMap = 'chernarus';
        } else if (detectedMap.includes('livonia')) {
          detectedMap = 'livonia';
        } else if (detectedMap.includes('sakhal')) {
          detectedMap = 'sakhal';
        } else if (detectedMap.includes('namalsk')) {
          detectedMap = 'namalsk';
        }
        
        // Update if different
        if (detectedMap !== map_name) {
          await db.query(
            `UPDATE nitrado_credentials SET map_name = $1 WHERE guild_id = $2`,
            [detectedMap, interaction.guildId]
          );
        }
      }

      // Build status indicator
      const statusEmoji = serverInfo.status === 'started' ? '🟢' : '🔴';
      const statusText = serverInfo.status === 'started' ? 'Online' : 'Offline';

      // Create info embed
      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${serverInfo.serverName || 'DayZ Server'} - Info`)
        .setColor(serverInfo.status === 'started' ? 0x00ff00 : 0xff0000)
        .addFields(
          {
            name: '📡 Status',
            value: `${statusEmoji} **${statusText}**`,
            inline: true
          },
          {
            name: '🗺️ Map',
            value: serverInfo.mapName ? `**${serverInfo.mapName}**` : 'Unknown',
            inline: true
          },
          {
            name: '👥 Players',
            value: `**${serverInfo.currentPlayers}/${serverInfo.maxPlayers}**`,
            inline: true
          },
          {
            name: '🌐 IP Address',
            value: `\`${serverInfo.ip}:${serverInfo.port}\``,
            inline: true
          },
          {
            name: '🎯 Slots',
            value: `**${serverInfo.slots}** max`,
            inline: true
          },
          {
            name: '📍 Location',
            value: `**${serverInfo.location}**`,
            inline: true
          },
          {
            name: '🎮 Game',
            value: `**${serverInfo.gameHuman}**`,
            inline: false
          }
        )
        .setFooter({ text: `Service ID: ${service_id} | Nitrado API` })
        .setTimestamp();

      // Add online players list if any
      if (onlinePlayers.length > 0) {
        const playerNames = onlinePlayers.map(p => p.name).join(', ');
        embed.addFields({
          name: '🟢 Online Players',
          value: playerNames.length > 1024 ? `${playerNames.substring(0, 1020)}...` : playerNames,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error fetching server info:', err);
      await interaction.editReply({
        content: '❌ Failed to fetch server info from Nitrado API. Please try again.',
        ephemeral: true
      });
    }
  }
};
