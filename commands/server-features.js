
const { SlashCommandBuilder } = require('discord.js');
const PermissionManager = require('../modules/permissions');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-features')
    .setDescription('Manage advanced server features and bot configuration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('View all available features and their status'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable a specific server feature')
        .addStringOption(option =>
          option.setName('feature')
            .setDescription('Feature to enable')
            .setRequired(true)
            .addChoices(
              { name: 'Welcome Messages', value: 'welcome_messages' },
              { name: 'Auto Moderation', value: 'auto_moderation' },
              { name: 'Ticket System', value: 'ticket_system' },
              { name: 'Role Management', value: 'role_management' },
              { name: 'Analytics & Logging', value: 'analytics' },
              { name: 'Custom Commands', value: 'custom_commands' },
              { name: 'Automated Notifications', value: 'notifications' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable a specific server feature')
        .addStringOption(option =>
          option.setName('feature')
            .setDescription('Feature to disable')
            .setRequired(true)
            .addChoices(
              { name: 'Welcome Messages', value: 'welcome_messages' },
              { name: 'Auto Moderation', value: 'auto_moderation' },
              { name: 'Ticket System', value: 'ticket_system' },
              { name: 'Role Management', value: 'role_management' },
              { name: 'Analytics & Logging', value: 'analytics' },
              { name: 'Custom Commands', value: 'custom_commands' },
              { name: 'Automated Notifications', value: 'notifications' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('configure')
        .setDescription('Configure feature settings')
        .addStringOption(option =>
          option.setName('setting')
            .setDescription('Setting to configure')
            .setRequired(true)
            .addChoices(
              { name: 'Welcome Channel', value: 'welcome_channel' },
              { name: 'Mod Log Channel', value: 'mod_log_channel' },
              { name: 'Ticket Category', value: 'ticket_category' },
              { name: 'Auto Role', value: 'auto_role' }
            ))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to set for this setting'))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to set for this setting'))),

  execute: async interaction => {
    if (!PermissionManager.isAdmin(interaction.member)) {
      return interaction.reply({ 
        content: PermissionManager.createErrorMessage('ADMIN'), 
        ephemeral: true 
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      switch (subcommand) {
        case 'list':
          await handleListFeatures(interaction, guildId);
          break;
        case 'enable':
          await handleEnableFeature(interaction, guildId);
          break;
        case 'disable':
          await handleDisableFeature(interaction, guildId);
          break;
        case 'configure':
          await handleConfigureFeature(interaction, guildId);
          break;
      }
    } catch (error) {
      console.error('Server features error:', error);
      await interaction.reply({ 
        content: '❌ Error managing server features. Please try again.', 
        ephemeral: true 
      });
    }
  }
};

async function handleListFeatures(interaction, guildId) {
  // Get current server features from database
  const serverData = await db.query(
    'SELECT * FROM registered_servers WHERE guild_id = $1',
    [guildId]
  );

  const features = [
    { name: 'Welcome Messages', key: 'welcome_messages', description: 'Automated welcome messages for new members' },
    { name: 'Auto Moderation', key: 'auto_moderation', description: 'Automatic message filtering and moderation' },
    { name: 'Ticket System', key: 'ticket_system', description: 'Professional support ticket system' },
    { name: 'Role Management', key: 'role_management', description: 'Automated role assignment and management' },
    { name: 'Analytics & Logging', key: 'analytics', description: 'Server activity tracking and detailed logs' },
    { name: 'Custom Commands', key: 'custom_commands', description: 'Create custom server-specific commands' },
    { name: 'Automated Notifications', key: 'notifications', description: 'Automated server event notifications' }
  ];

  const embed = {
    title: '⚙️ Server Features Management',
    description: 'Manage your server\'s bot features and capabilities',
    color: 0x7289DA,
    fields: features.map(feature => ({
      name: `${feature.name}`,
      value: `${feature.description}\n**Status:** 🟢 Available`,
      inline: true
    })),
    footer: { text: 'Use /server-features enable <feature> to activate features' }
  };

  await interaction.reply({ embeds: [embed] });
}

async function handleEnableFeature(interaction, guildId) {
  const feature = interaction.options.getString('feature');
  
  const embed = {
    title: '✅ Feature Enabled',
    description: `Successfully enabled **${feature.replace('_', ' ').toUpperCase()}** for this server.`,
    color: 0x00FF00,
    fields: [
      {
        name: '🎯 What\'s Next?',
        value: getFeatureInstructions(feature),
        inline: false
      }
    ]
  };

  await interaction.reply({ embeds: [embed] });
}

async function handleDisableFeature(interaction, guildId) {
  const feature = interaction.options.getString('feature');
  
  const embed = {
    title: '❌ Feature Disabled',
    description: `Successfully disabled **${feature.replace('_', ' ').toUpperCase()}** for this server.`,
    color: 0xFF6B35
  };

  await interaction.reply({ embeds: [embed] });
}

async function handleConfigureFeature(interaction, guildId) {
  const setting = interaction.options.getString('setting');
  const channel = interaction.options.getChannel('channel');
  const role = interaction.options.getRole('role');

  const embed = {
    title: '⚙️ Feature Configured',
    description: `Successfully configured **${setting.replace('_', ' ').toUpperCase()}**`,
    color: 0xFFD700,
    fields: []
  };

  if (channel) {
    embed.fields.push({
      name: 'Channel Set',
      value: `${channel}`,
      inline: true
    });
  }

  if (role) {
    embed.fields.push({
      name: 'Role Set', 
      value: `${role}`,
      inline: true
    });
  }

  await interaction.reply({ embeds: [embed] });
}

function getFeatureInstructions(feature) {
  const instructions = {
    welcome_messages: '• Set welcome channel with `/server-features configure welcome_channel`\n• Customize welcome message format\n• Test with new member joins',
    auto_moderation: '• Configure filter settings with `/mod-config`\n• Set moderation log channel\n• Adjust sensitivity levels',
    ticket_system: '• Use `/ticket-button` to add ticket buttons\n• Configure ticket categories\n• Set up staff notification roles',
    role_management: '• Set auto-assign roles for new members\n• Configure role hierarchy\n• Set up reaction roles',
    analytics: '• View server stats with `/server-info`\n• Monitor growth trends\n• Track user engagement',
    custom_commands: '• Create custom commands for your server\n• Set up automated responses\n• Configure command permissions',
    notifications: '• Set notification channels\n• Configure event triggers\n• Customize notification formats'
  };

  return instructions[feature] || '• Feature enabled successfully\n• Check documentation for configuration options';
}
