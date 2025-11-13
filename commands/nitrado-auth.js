const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { NitradoAuthManager } = require('../modules/nitradoAuth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nitrado-auth')
    .setDescription('Manage Nitrado API authentication and permissions')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-token')
        .setDescription('Add your Nitrado API token')
        .addStringOption(option =>
          option.setName('token').setDescription('Your Nitrado API token').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('service-id').setDescription('Nitrado service ID').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('oauth-login').setDescription('Login using Nitrado OAuth2 (recommended)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove-token')
        .setDescription('Remove your Nitrado API token')
        .addStringOption(option =>
          option.setName('service-id').setDescription('Nitrado service ID').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set-permissions')
        .setDescription('Set user permissions for Nitrado service (Admin only)')
        .addUserOption(option =>
          option.setName('user').setDescription('User to set permissions for').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('service-id').setDescription('Nitrado service ID').setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('Permission level')
            .setRequired(true)
            .addChoices(
              { name: 'Viewer (Read-only)', value: 1 },
              { name: 'Operator (Restart, Commands)', value: 2 },
              { name: 'Admin (Settings, Files)', value: 3 },
              { name: 'Owner (Full Access)', value: 4 }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list-users')
        .setDescription('List users with access to a service')
        .addStringOption(option =>
          option.setName('service-id').setDescription('Nitrado service ID').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('revoke-access')
        .setDescription('Revoke user access to a service (Admin only)')
        .addUserOption(option =>
          option.setName('user').setDescription('User to revoke access from').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('service-id').setDescription('Nitrado service ID').setRequired(true)
        )
    ),

  async execute(interaction) {
    // CRITICAL: Defer IMMEDIATELY before ANY processing to avoid timeout
    try {
      await interaction.deferReply({ flags: 64 });
    } catch (deferError) {
      // If defer fails, interaction is dead - abort completely
      console.error('❌ Defer failed, interaction expired:', deferError.message);
      return;
    }

    const authManager = new NitradoAuthManager();
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {

      switch (subcommand) {
        case 'add-token':
          await this.handleAddToken(interaction, authManager, guildId, userId);
          break;
        case 'oauth-login':
          await this.handleOAuthLogin(interaction, authManager, guildId, userId);
          break;
        case 'remove-token':
          await this.handleRemoveToken(interaction, authManager, guildId, userId);
          break;
        case 'set-permissions':
          await this.handleSetPermissions(interaction, authManager, guildId, userId);
          break;
        case 'list-users':
          await this.handleListUsers(interaction, authManager, guildId);
          break;
        case 'revoke-access':
          await this.handleRevokeAccess(interaction, authManager, guildId, userId);
          break;
      }
    } catch (error) {
      console.error('Nitrado auth command error:', error);
      
      // Always use editReply since we defer immediately
      try {
        await interaction.editReply({ content: `❌ An error occurred: ${error.message}` });
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError.message);
      }
    }
  },

  async handleAddToken(interaction, authManager, guildId, userId) {
    const token = interaction.options.getString('token');
    const serviceId = interaction.options.getString('service-id');

    try {
      await authManager.storeToken(
        guildId,
        userId,
        serviceId,
        token,
        authManager.PERMISSION_LEVELS.VIEWER
      );

      // Auto-start all monitoring services
      await this.startAllMonitoring(interaction, guildId, serviceId, token);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Nitrado Connected & Monitoring Started')
        .setDescription(
          `Your Nitrado API token has been securely stored for service \`${serviceId}\` and all monitoring is now active!`
        )
        .addFields(
          { name: 'Permission Level', value: 'Viewer (Read-only)', inline: true },
          { name: 'Service ID', value: serviceId, inline: true },
          { name: '🛰️ Satellite Feed', value: 'Active - Players online updates', inline: true },
          { name: '💀 Kill Feed', value: 'Active - PvP events', inline: true },
          { name: '🚪 Login/Logout', value: 'Active - Player activity', inline: true },
          { name: '🏠 PvE Events', value: 'Active - Building/raiding', inline: true }
        )
        .setFooter({ text: 'All monitoring services are now running automatically!' });

      // Always use editReply since we defer immediately
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      // Always use editReply since we defer immediately
      await interaction.editReply({ content: `❌ Failed to add token: ${error.message}` });
    }
  },

  async handleRemoveToken(interaction, authManager, guildId, userId) {
    const serviceId = interaction.options.getString('service-id');

    try {
      await authManager.revokeAccess(guildId, userId, serviceId);

      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('🗑️ Token Removed')
        .setDescription(`Your Nitrado API access has been removed for service \`${serviceId}\`.`);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to remove token: ${error.message}`,
        flags: 64,
      });
    }
  },

  async handleSetPermissions(interaction, authManager, guildId, userId) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply({
        content: '❌ You need Administrator permissions to set user permissions.',
        flags: 64,
      });
    }

    const targetUser = interaction.options.getUser('user');
    const serviceId = interaction.options.getString('service-id');
    const level = interaction.options.getInteger('level');

    try {
      await authManager.setUserPermissions(guildId, targetUser.id, serviceId, level);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('✅ Permissions Updated')
        .setDescription(`Updated permissions for ${targetUser.tag}`)
        .addFields(
          { name: 'Service ID', value: serviceId, inline: true },
          { name: 'Permission Level', value: authManager.getPermissionName(level), inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to set permissions: ${error.message}`,
        flags: 64,
      });
    }
  },

  async handleListUsers(interaction, authManager, guildId) {
    const serviceId = interaction.options.getString('service-id');

    try {
      const users = await authManager.getServiceUsers(guildId, serviceId);

      if (users.length === 0) {
        return await interaction.editReply({
          content: `No users have access to service \`${serviceId}\`.`,
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`👥 Users with Access to Service ${serviceId}`)
        .setDescription(
          users
            .map(
              user =>
                `<@${user.discord_id}> - ${authManager.getPermissionName(user.permission_level || 1)}`
            )
            .join('\n')
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to list users: ${error.message}`,
        flags: 64,
      });
    }
  },

  async handleRevokeAccess(interaction, authManager, guildId, userId) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.editReply({
        content: '❌ You need Administrator permissions to revoke user access.',
        flags: 64,
      });
    }

    const targetUser = interaction.options.getUser('user');
    const serviceId = interaction.options.getString('service-id');

    try {
      await authManager.revokeAccess(guildId, targetUser.id, serviceId);

      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🚫 Access Revoked')
        .setDescription(
          `Revoked Nitrado access for ${targetUser.tag} on service \`${serviceId}\`.`
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to revoke access: ${error.message}`,
        flags: 64,
      });
    }
  },

  async handleOAuthLogin(interaction, authManager, guildId, userId) {
    try {
      const authData = authManager.generateAuthURL(guildId, userId, '/dashboard');

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🔐 Nitrado OAuth2 Login')
        .setDescription(
          'Click the link below to securely connect your Nitrado account using OAuth2.'
        )
        .addFields(
          {
            name: '🔗 Authorization Link',
            value: `[Click here to authorize](${authData.authURL})`,
          },
          {
            name: '⚠️ Security Note',
            value:
              'This is the official Nitrado OAuth2 flow - much more secure than manual tokens!',
          },
          {
            name: '🔒 What happens next?',
            value:
              "You'll be redirected to Nitrado, login there, then back to our bot. All monitoring will start automatically!",
          },
          {
            name: '🚀 Auto-Start Features',
            value:
              '• Satellite feed (players online)\n• Kill feed (PvP events)\n• Login/logout tracking\n• PvE building events',
          }
        )
        .setFooter({ text: 'This link expires in 10 minutes for security' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to generate OAuth2 URL: ${error.message}`,
        flags: 64,
      });
    }
  },

  /**
   * Auto-start all monitoring services after successful Nitrado authentication
   */
  async startAllMonitoring(interaction, guildId, serviceId, token) {
    try {
      const { NitradoPollingMonitor } = require('../modules/nitradoPollingMonitor');
      const { SatelliteUpdater } = require('../modules/satelliteUpdater');
      const { getPool } = require('../modules/db');
      const logger = require('../modules/logger');

      // Get database pool
      const pool = await getPool();

      // Start ALL monitoring feeds automatically
      const satelliteUpdater = interaction.client.satelliteUpdater;
      const pollingMonitor = interaction.client.nitradoPollingMonitor;

      // Start satellite monitoring (updates every 30 seconds)
      if (satelliteUpdater) {
        satelliteUpdater.startUpdating(interaction.client);
        logger.info(`🛰️ Started satellite monitoring for guild ${guildId}`);
      }

      // Start log polling monitor for ALL feeds (checks every 5 minutes)
      if (pollingMonitor) {
        // Get all configured feed channels
        const channelCheck = await pool.query(
          'SELECT * FROM guild_channels WHERE guild_id = $1',
          [guildId]
        );

        if (channelCheck.rows.length > 0) {
          const channels = channelCheck.rows[0];

          // Start monitoring with all feed channels configured
          const monitoringStarted = await pollingMonitor.startMonitoring(
            serviceId, 
            token, 
            channels.satellite_channel_id, // Primary channel for logs
            {
              killFeedChannel: channels.kill_feed_channel_id,
              pveFeedChannel: channels.pve_feed_channel_id,
              connectionsFeedChannel: channels.connections_feed_channel_id,
              eventFeedChannel: channels.event_feed_channel_id,
              buildingActivityChannel: channels.building_activity_channel_id,
              playerLocationChannel: channels.player_location_channel_id,
              placedItemsChannel: channels.placed_items_channel_id,
              flagFeedChannel: channels.flag_feed_channel_id,
              factionLogsChannel: channels.faction_logs_channel_id
            }
          );

          if (monitoringStarted) {
            logger.info(`📡 Started full monitoring suite for guild ${guildId} with all feed channels`);
          }
        }
      }

      // Store monitoring status
      await pool.query(
        `INSERT INTO guild_monitoring_status (guild_id, service_id, is_active, auto_started, started_at) 
         VALUES ($1, $2, true, true, NOW()) 
         ON CONFLICT (guild_id, service_id) 
         DO UPDATE SET is_active = true, auto_started = true, started_at = NOW()`,
        [guildId, serviceId]
      );

      return true;
    } catch (error) {
      console.error('Error auto-starting monitoring:', error);
      return false;
    }
  },
};
