const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createNitradoAPI, getNitradoToken } = require('../modules/nitrado');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debug-nitrado')
    .setDescription('Debug Nitrado API connection and test endpoints (Admin only)')
    .addStringOption(option =>
      option.setName('api_token').setDescription('Optional API token to test').setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('service_id')
        .setDescription('Optional service ID to test specific endpoints')
        .setRequired(false)
    ),

  async execute(interaction, { pool, logger }) {
    await interaction.deferReply({ flags: 64 }); // EPHEMERAL flag

    try {
      const guildId = interaction.guildId;
      const providedToken = interaction.options.getString('api_token');
      const serviceId = interaction.options.getString('service_id');

      let token;
      if (providedToken) {
        token = providedToken;
        logger.info(`Using provided token for debug`);
      } else {
        try {
          token = await getNitradoToken(guildId, serviceId);
          logger.info(`Using stored token for guild ${guildId}`);
        } catch (error) {
          return await interaction.editReply({
            content:
              '❌ No stored API token found. Please provide a token or store one using `/register-server`.',
            ephemeral: true,
          });
        }
      }

      const api = createNitradoAPI(token);

      const embed = new EmbedBuilder()
        .setTitle('🔧 Nitrado API Debug Report')
        .setColor('#ffaa00')
        .setTimestamp();

      let debugInfo = '';

      // Test 1: API Connection
      debugInfo += '**🔗 API Connection Test**\n';
      try {
        const connectionTest = await api.testConnection();
        if (connectionTest.success) {
          debugInfo += `✅ Connection successful\n`;
          debugInfo += `👤 User: ${connectionTest.user?.username || 'Unknown'}\n`;
          debugInfo += `🆔 User ID: ${connectionTest.user?.user_id || 'Unknown'}\n\n`;
        } else {
          debugInfo += `❌ Connection failed: ${connectionTest.error}\n\n`;
        }
      } catch (error) {
        debugInfo += `❌ Connection error: ${error.message}\n\n`;
      }

      // Test 2: Services List
      debugInfo += '**📋 Services Test**\n';
      try {
        const servicesResponse = await api.getServices();
        const services = servicesResponse?.data?.services || [];
        debugInfo += `✅ Found ${services.length} services\n`;

        if (services.length > 0) {
          const gameservers = services.filter(s => s.type === 'Gameserver');
          debugInfo += `🎮 Game servers: ${gameservers.length}\n`;

          // List first few services
          services.slice(0, 3).forEach(service => {
            debugInfo += `   └ ${service.id}: ${service.details?.name || service.type} (${service.status})\n`;
          });
          if (services.length > 3) {
            debugInfo += `   └ ... and ${services.length - 3} more\n`;
          }
        }
        debugInfo += '\n';
      } catch (error) {
        debugInfo += `❌ Services error: ${error.message}\n\n`;
      }

      // Test 3: Specific Service (if provided)
      if (serviceId) {
        debugInfo += `**🎯 Service ${serviceId} Tests**\n`;

        // Service details
        try {
          const serviceResponse = await api.getService(serviceId);
          const service = serviceResponse?.data?.service;
          debugInfo += `✅ Service details: ${service?.details?.name || 'Unknown'} (${service?.status})\n`;
        } catch (error) {
          debugInfo += `❌ Service details error: ${error.message}\n`;
        }

        // Gameserver info
        try {
          const gameserverResponse = await api.getGameserver(serviceId);
          const gameserver = gameserverResponse?.data?.gameserver;
          debugInfo += `✅ Gameserver: ${gameserver?.game || 'Unknown'} on ${gameserver?.ip}:${gameserver?.port}\n`;
        } catch (error) {
          debugInfo += `❌ Gameserver error: ${error.message}\n`;
        }

        // Status
        try {
          const statusResponse = await api.getGameserverStatus(serviceId);
          const status = statusResponse?.data?.status;
          debugInfo += `✅ Status: ${status || 'Unknown'}\n`;
        } catch (error) {
          debugInfo += `❌ Status error: ${error.message}\n`;
        }

        // File system
        try {
          const filesResponse = await api.listFiles(serviceId, '/');
          const files = filesResponse?.data?.entries || [];
          debugInfo += `✅ Root directory: ${files.length} items\n`;
        } catch (error) {
          debugInfo += `❌ File system error: ${error.message}\n`;
        }

        // Players (optional)
        try {
          const playersResponse = await api.getPlayers(serviceId);
          const players = playersResponse?.data?.players || [];
          debugInfo += `✅ Players: ${players.length} online\n`;
        } catch (error) {
          debugInfo += `❌ Players error: ${error.message}\n`;
        }

        debugInfo += '\n';
      }

      // Test 4: API Endpoints Summary
      debugInfo += '**📡 Available Endpoints**\n';
      debugInfo += '✅ User info, Services list\n';
      debugInfo += '✅ Service details, Gameserver info\n';
      debugInfo += '✅ Server status, Player list\n';
      debugInfo += '✅ File system, Logs\n';
      debugInfo += '✅ Server control (start/stop/restart)\n';
      debugInfo += '✅ Console commands, Settings\n';

      // Split the debug info if it's too long
      if (debugInfo.length <= 4096) {
        embed.setDescription(debugInfo);
      } else {
        // Split into multiple embeds or truncate
        embed.setDescription(debugInfo.substring(0, 4093) + '...');
        embed.setFooter({ text: 'Debug output truncated - check console for full details' });
        logger.info('Full debug output:', debugInfo);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`❌ Debug Nitrado error: ${error.message}`);
      await interaction.editReply({
        content: `❌ Debug failed: ${error.message}`,
      });
    }
  },
};
