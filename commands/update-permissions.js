const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
} = require('discord.js');
const logger = require('../modules/logger');
const centralConfig = require('../config/central.config.json');
const subscriberConfig = require('../config/subscriber.config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update-permissions')
    .setDescription('Update channel permissions based on current configuration')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to update permissions for')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('reset_all')
        .setDescription('Reset all permissions before applying new ones (default: false)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    await interaction.deferReply();

    const guild = interaction.guild;
    const targetChannel = interaction.options.getChannel('channel');
    const resetAll = interaction.options.getBoolean('reset_all') ?? false;

    // Detect if this is GCC or a subscriber server
    const isGCC = guild.id === process.env.GRIZZLY_COMMAND_GUILD_ID;
    const config = isGCC ? centralConfig : subscriberConfig;

    logger.info(`Updating permissions for: ${targetChannel.name} in ${guild.name}`);

    try {
      // Find the channel/category in config
      let foundConfig = null;
      const isCategory = targetChannel.type === ChannelType.GuildCategory;

      if (isCategory) {
        // Look for category config
        foundConfig = config.categories.find(cat => cat.name === targetChannel.name);
      } else {
        // Look for channel in any category
        for (const categoryConfig of config.categories) {
          if (categoryConfig.channels.includes(targetChannel.name)) {
            foundConfig = categoryConfig;
            break;
          }
        }
      }

      if (!foundConfig) {
        return await interaction.editReply({
          content: `❌ **Configuration Not Found**\n\nNo permission configuration found for ${isCategory ? 'category' : 'channel'} \`${targetChannel.name}\` in the bot's configuration files.`,
        });
      }

      // Reset permissions if requested
      if (resetAll) {
        await targetChannel.permissionOverwrites.set([]);
        logger.info(`Reset all permissions for ${targetChannel.name}`);
      }

      // Apply new permissions from config
      const permissionOverwrites = [];
      const permissions = foundConfig.permissions || {};

      // Start with @everyone permissions
      if (permissions['@everyone'] && permissions['@everyone'].length > 0) {
        permissionOverwrites.push({
          id: guild.roles.everyone.id,
          allow: permissions['@everyone']
            .map(p => PermissionsBitField.Flags[p])
            .filter(p => p !== undefined),
          deny: [],
        });
      } else {
        // Default deny view for security (when @everyone is undefined or empty array)
        permissionOverwrites.push({
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        });
      }

      // Apply role-specific permissions
      const rolesApplied = [];
      const rolesMissing = [];

      for (const [roleName, perms] of Object.entries(permissions)) {
        if (roleName === '@everyone') {
          continue;
        }

        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role) {
          permissionOverwrites.push({
            id: role.id,
            allow: perms.map(p => PermissionsBitField.Flags[p]).filter(p => p !== undefined),
            deny: [],
          });
          rolesApplied.push(roleName);
        } else {
          rolesMissing.push(roleName);
        }
      }

      // Apply special permissions for specific channel types
      if (!isCategory) {
        await applySpecialChannelPermissions(targetChannel, guild, permissionOverwrites);
      }

      // Set the permissions
      await targetChannel.permissionOverwrites.set(permissionOverwrites);

      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('✅ Permissions Updated Successfully')
        .setDescription(`Updated permissions for ${targetChannel}`)
        .addFields([
          {
            name: '🎭 Roles Applied',
            value: rolesApplied.length > 0 ? rolesApplied.join(', ') : 'None',
            inline: false,
          },
          {
            name: '⚠️ Missing Roles',
            value: rolesMissing.length > 0 ? rolesMissing.join(', ') : 'None',
            inline: false,
          },
          {
            name: '🔧 Actions Taken',
            value: resetAll
              ? '• Reset all existing permissions\n• Applied configuration permissions\n• Added special channel rules'
              : '• Updated configuration permissions\n• Added special channel rules',
            inline: false,
          },
        ])
        .setColor(rolesMissing.length > 0 ? 0xff9900 : 0x00ff00)
        .setTimestamp();

      if (rolesMissing.length > 0) {
        embed.addFields([
          {
            name: '💡 Suggestion',
            value:
              'Use `/setup-channels` to create missing roles, or `/role-management` to create them manually.',
            inline: false,
          },
        ]);
      }

      try {
        await interaction.editReply({ embeds: [embed] });
      } catch (embedError) {
        logger.error('Failed to send embed, using text fallback:', embedError);
        const summary = `✅ **Permissions Updated**\n\n` +
          `Channel: ${targetChannel}\n` +
          `Roles Applied: ${rolesApplied.join(', ') || 'None'}\n` +
          `Missing Roles: ${rolesMissing.join(', ') || 'None'}`;
        await interaction.editReply({ content: summary });
      }
      
      logger.info(`Successfully updated permissions for: ${targetChannel.name}`);
    } catch (error) {
      logger.error(`Failed to update permissions for ${targetChannel.name}:`, error);
      try {
        await interaction.editReply({
          content: `❌ **Permission Update Failed**\n\nError: ${error.message}`,
        });
      } catch (replyError) {
        logger.error('Could not send error reply:', replyError);
      }
    }
  },
};

async function applySpecialChannelPermissions(channel, guild, permissionOverwrites) {
  const channelName = channel.name;

  // Define special permission rules for specific channels
  const specialChannels = {
    'server-updates': { allowStaffOnly: true, readOnly: true },
    'welcome-message': { allowStaffOnly: true, readOnly: true },
    rules: { adminEditable: true },
    'admin-chat': { adminOnly: true },
    'moderator-chat': { modOnly: true },
    satellite: { adminOnly: true },
    killfeed: { readOnly: true },
    'event-feed': { readOnly: true },
    'connections-feed': { readOnly: true },
    pvefeed: { readOnly: true },
    'placed-items-feed': { readOnly: true },
    'built-items-feed': { readOnly: true },
    'player-locations': { readOnly: true },
    'flag-feed': { readOnly: true },
    'faction-logs': { readOnly: true },
  };

  const channelConfig = specialChannels[channelName];
  if (!channelConfig) {
    return;
  }

  const adminRole = guild.roles.cache.find(r => r.name === 'Admin');
  const modRole = guild.roles.cache.find(r => r.name === 'Moderator');

  if (channelConfig.readOnly) {
    // Make channel read-only for everyone, staff can still post
    const everyoneOverwrite = permissionOverwrites.find(p => p.id === guild.roles.everyone.id);
    if (everyoneOverwrite) {
      everyoneOverwrite.deny = [
        ...(everyoneOverwrite.deny || []),
        PermissionsBitField.Flags.SendMessages,
      ];
    }

    // Allow staff to post in read-only channels
    if (adminRole) {
      let adminOverwrite = permissionOverwrites.find(p => p.id === adminRole.id);
      if (!adminOverwrite) {
        adminOverwrite = { id: adminRole.id, allow: [], deny: [] };
        permissionOverwrites.push(adminOverwrite);
      }
      adminOverwrite.allow = [
        ...(adminOverwrite.allow || []),
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageMessages,
      ];
    }
  }

  if (channelConfig.adminOnly && adminRole) {
    // Admin-only channel
    const everyoneOverwrite = permissionOverwrites.find(p => p.id === guild.roles.everyone.id);
    if (everyoneOverwrite) {
      everyoneOverwrite.deny = [
        ...(everyoneOverwrite.deny || []),
        PermissionsBitField.Flags.ViewChannel,
      ];
    }
  }

  if (channelConfig.modOnly && modRole) {
    // Moderator+ channel
    const everyoneOverwrite = permissionOverwrites.find(p => p.id === guild.roles.everyone.id);
    if (everyoneOverwrite) {
      everyoneOverwrite.deny = [
        ...(everyoneOverwrite.deny || []),
        PermissionsBitField.Flags.ViewChannel,
      ];
    }

    // Allow moderators
    let modOverwrite = permissionOverwrites.find(p => p.id === modRole.id);
    if (!modOverwrite) {
      modOverwrite = { id: modRole.id, allow: [], deny: [] };
      permissionOverwrites.push(modOverwrite);
    }
    modOverwrite.allow = [
      ...(modOverwrite.allow || []),
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
    ];
  }

  if (channelConfig.adminEditable && adminRole) {
    // Admin can edit/manage content
    let adminOverwrite = permissionOverwrites.find(p => p.id === adminRole.id);
    if (!adminOverwrite) {
      adminOverwrite = { id: adminRole.id, allow: [], deny: [] };
      permissionOverwrites.push(adminOverwrite);
    }
    adminOverwrite.allow = [
      ...(adminOverwrite.allow || []),
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AttachFiles,
    ];
  }
}
