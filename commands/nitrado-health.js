const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../modules/db.js');
const { decrypt } = require('../utils/encryption.js');
const { NitradoAPI } = require('../modules/nitrado.js');
const logger = require('../config/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nitrado-health')
    .setDescription('Check Nitrado API connection health and token status')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guild.id;

      const tokenResult = await db.query(
        'SELECT service_id, encrypted_token, token_iv, auth_tag, updated_at FROM nitrado_credentials WHERE guild_id = $1 AND service_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1',
        [guildId]
      );

      if (tokenResult.rows.length === 0) {
        return await interaction.editReply({
          content: '❌ No Nitrado token found. Use `/nitrado-auth add-token` to add one.',
        });
      }

      const row = tokenResult.rows[0];
      const token = decrypt(row.encrypted_token, row.token_iv, row.auth_tag);
      const serviceId = row.service_id;

      const healthChecks = [];
      const startTime = Date.now();

      const embed = new EmbedBuilder()
        .setTitle('🏥 Nitrado Health Check')
        .setColor('#00ff00')
        .setTimestamp();

      const api = new NitradoAPI(token);

      try {
        const userInfo = await api.getUserInfo();
        healthChecks.push({
          name: '✅ API Authentication',
          value: `Status: **Connected**\nUser: ${userInfo.data.user.username || 'Unknown'}`,
          inline: false,
        });
      } catch (error) {
        healthChecks.push({
          name: '❌ API Authentication',
          value: `Status: **Failed**\nError: ${error.message}`,
          inline: false,
        });
      }

      try {
        const gameserver = await api.getGameserver(serviceId);
        const status = gameserver.data.gameserver.status;
        const game = gameserver.data.gameserver.game;
        
        healthChecks.push({
          name: '✅ Gameserver Connection',
          value: `Service ID: **${serviceId}**\nGame: **${game}**\nStatus: **${status}**`,
          inline: false,
        });
      } catch (error) {
        healthChecks.push({
          name: '❌ Gameserver Connection',
          value: `Service ID: **${serviceId}**\nError: ${error.message}`,
          inline: false,
        });
      }

      try {
        const logs = await api.console.getLogs(serviceId, 1);
        const logCount = logs?.data?.logs?.length || 0;
        
        healthChecks.push({
          name: '✅ Log Access',
          value: `Recent logs: **${logCount} entries**\nAccess: **Granted**`,
          inline: false,
        });
      } catch (error) {
        healthChecks.push({
          name: '⚠️ Log Access',
          value: `Access: **Limited**\nNote: ${error.message}`,
          inline: false,
        });
      }

      try {
        const gamePath = `/games/ni${serviceId}_1`;
        const files = await api.files.listFiles(serviceId, gamePath, false, 1);
        const fileCount = files?.data?.entries?.length || 0;
        
        healthChecks.push({
          name: '✅ File Server Access',
          value: `Game directory: **${fileCount} items**\nAccess: **Granted**`,
          inline: false,
        });
      } catch (error) {
        healthChecks.push({
          name: '⚠️ File Server Access',
          value: `Access: **Limited**\nNote: ${error.message}`,
          inline: false,
        });
      }

      const wsResult = await db.query(
        'SELECT active, last_update FROM websocket_connections WHERE service_id = $1',
        [serviceId]
      );

      if (wsResult.rows.length > 0 && wsResult.rows[0].active) {
        const lastUpdate = new Date(wsResult.rows[0].last_update);
        const timeSince = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
        
        healthChecks.push({
          name: '✅ WebSocket Monitoring',
          value: `Status: **Active**\nLast update: **${timeSince}s ago**`,
          inline: false,
        });
      } else {
        healthChecks.push({
          name: '⚠️ WebSocket Monitoring',
          value: `Status: **Inactive**\nFallback: **Polling mode active**`,
          inline: false,
        });
      }

      const notifResult = await db.query(
        `SELECT COUNT(*) as total, 
         COUNT(*) FILTER (WHERE level = 'SEVERE') as severe,
         COUNT(*) FILTER (WHERE level = 'WARNING') as warning
         FROM service_notifications 
         WHERE service_id = $1 AND NOT dismissed`,
        [serviceId]
      );

      const notifStats = notifResult.rows[0];
      const totalNotifs = parseInt(notifStats.total) || 0;
      
      if (totalNotifs === 0) {
        healthChecks.push({
          name: '✅ Service Notifications',
          value: `Active alerts: **None**\nStatus: **All clear**`,
          inline: false,
        });
      } else {
        const severe = parseInt(notifStats.severe) || 0;
        const warning = parseInt(notifStats.warning) || 0;
        const status = severe > 0 ? '🚨 Critical' : warning > 0 ? '⚠️ Warnings' : 'ℹ️ Info';
        
        healthChecks.push({
          name: `${severe > 0 ? '🚨' : '📢'} Service Notifications`,
          value: `Status: **${status}**\nSevere: **${severe}** | Warning: **${warning}** | Total: **${totalNotifs}**`,
          inline: false,
        });
      }

      const statsResult = await db.query(
        `SELECT current_players, max_players, cpu_usage, memory_usage, timestamp
         FROM resource_stats 
         WHERE service_id = $1 
         ORDER BY timestamp DESC LIMIT 1`,
        [serviceId]
      );

      if (statsResult.rows.length > 0) {
        const stats = statsResult.rows[0];
        const timeSince = Math.floor((Date.now() - new Date(stats.timestamp).getTime()) / 1000 / 60);
        
        healthChecks.push({
          name: '📊 Resource Stats',
          value: `Players: **${stats.current_players}/${stats.max_players}**\nCPU: **${stats.cpu_usage?.toFixed(1) || 'N/A'}%** | RAM: **${stats.memory_usage?.toFixed(0) || 'N/A'} MB**\nUpdated: **${timeSince}m ago**`,
          inline: false,
        });
      } else {
        healthChecks.push({
          name: 'ℹ️ Resource Stats',
          value: `No data available yet\nMonitor will collect stats soon`,
          inline: false,
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      embed.addFields(healthChecks);
      embed.setFooter({ text: `Health check completed in ${totalTime}ms` });

      const failedChecks = healthChecks.filter(check => check.name.startsWith('❌')).length;
      
      if (failedChecks === 0) {
        embed.setColor('#00ff00');
        embed.setDescription('✅ All systems operational');
      } else if (failedChecks <= 2) {
        embed.setColor('#ffaa00');
        embed.setDescription('⚠️ Some systems experiencing issues');
      } else {
        embed.setColor('#ff0000');
        embed.setDescription('❌ Critical issues detected - check your token and permissions');
      }

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Health check completed for guild ${guildId}: ${failedChecks} failures`);

    } catch (error) {
      logger.error(`Health check error: ${error.message}`, error);
      await interaction.editReply({
        content: `❌ Health check failed: ${error.message}`,
      });
    }
  },
};
