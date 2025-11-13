const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const logger = require('../config/logger.js');
const centralConfig = require('../config/central.config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gcc-manage')
    .setDescription('GCC: Manage channels, content, and permissions')
    .addSubcommand(subcommand =>
      subcommand
        .setName('content')
        .setDescription('Populate or repopulate channel content')
        .addStringOption(option =>
          option
            .setName('target')
            .setDescription('Content to populate')
            .setRequired(true)
            .addChoices(
              { name: 'Welcome Message', value: 'welcome' },
              { name: 'Rules', value: 'rules' },
              { name: 'Bot Invites', value: 'bot-invites' },
              { name: 'Grizzly Bot Invite', value: 'grizzly-invite' },
              { name: 'About Bots', value: 'about-bots' },
              { name: 'How to Subscribe', value: 'how-to-subscribe' },
              { name: 'Verify Patreon', value: 'verify-patreon' },
              { name: 'All Content', value: 'all' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('repopulate')
            .setDescription('Clear existing content first (default: false)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('channels')
        .setDescription('Manage GCC channels')
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Action to perform')
            .setRequired(true)
            .addChoices(
              { name: 'Setup All Channels', value: 'setup' },
              { name: 'Fix All Channels', value: 'fix' },
              { name: 'Cleanup Unused', value: 'cleanup' },
              { name: 'Update Channel Info', value: 'update-info' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('permissions')
        .setDescription('Update channel permissions')
        .addBooleanOption(option =>
          option
            .setName('reset_all')
            .setDescription('Reset all permissions before applying new ones (default: false)')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction, { client }) {
    const guild = interaction.guild;

    // Only run in GCC
    if (guild.id !== process.env.GRIZZLY_COMMAND_GUILD_ID) {
      return await interaction.reply({
        content: '❌ This command can only be used in Grizzly Command Central.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'content':
          await handleContent(interaction, guild);
          break;
        case 'channels':
          await handleChannels(interaction, guild);
          break;
        case 'permissions':
          await handlePermissions(interaction, guild);
          break;
      }
    } catch (error) {
      logger.error(`Error in gcc-manage ${subcommand}:`, error);
      const reply = {
        content: `❌ **Error**\n\n${error.message}`,
        ephemeral: true
      };
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },
};

/**
 * Handle content population/repopulation
 */
async function handleContent(interaction, guild) {
  const target = interaction.options.getString('target');
  const repopulate = interaction.options.getBoolean('repopulate') ?? false;

  await interaction.reply({
    content: `🔄 ${repopulate ? 'Repopulating' : 'Populating'} ${target}...`,
    ephemeral: false
  });

  // Load the appropriate populate module
  const results = [];
  
  try {
    switch (target) {
      case 'welcome':
        results.push(await populateWelcome(guild, repopulate));
        break;
      case 'rules':
        results.push(await populateRules(guild, repopulate));
        break;
      case 'bot-invites':
        results.push(await populateBotInvites(guild, repopulate));
        break;
      case 'grizzly-invite':
        results.push(await populateGrizzlyInvite(guild, repopulate));
        break;
      case 'about-bots':
        results.push(await populateAboutBots(guild, repopulate));
        break;
      case 'how-to-subscribe':
        results.push(await populateHowToSubscribe(guild, repopulate));
        break;
      case 'verify-patreon':
        results.push(await populateVerifyPatreon(guild, repopulate));
        break;
      case 'all':
        results.push(await populateWelcome(guild, repopulate));
        results.push(await populateRules(guild, repopulate));
        results.push(await populateBotInvites(guild, repopulate));
        results.push(await populateGrizzlyInvite(guild, repopulate));
        results.push(await populateAboutBots(guild, repopulate));
        results.push(await populateHowToSubscribe(guild, repopulate));
        results.push(await populateVerifyPatreon(guild, repopulate));
        break;
    }

    const embed = new EmbedBuilder()
      .setTitle(`✅ Content ${repopulate ? 'Repopulated' : 'Populated'}`)
      .setDescription(results.filter(r => r).join('\n'))
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  } catch (error) {
    logger.error('Content population error:', error);
    await interaction.editReply({
      content: `❌ Failed to populate content: ${error.message}`
    });
  }
}

/**
 * Handle channel management
 */
async function handleChannels(interaction, guild) {
  const action = interaction.options.getString('action');

  await interaction.reply({
    content: `🔄 Performing ${action} on GCC channels...`,
    ephemeral: false
  });

  try {
    let result;
    switch (action) {
      case 'setup':
        result = await setupAllChannels(guild);
        break;
      case 'fix':
        result = await fixAllChannels(guild);
        break;
      case 'cleanup':
        result = await cleanupChannels(guild);
        break;
      case 'update-info':
        result = await updateChannelInfo(guild);
        break;
    }

    const embed = new EmbedBuilder()
      .setTitle(`✅ Channel ${action} Complete`)
      .setDescription(result)
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  } catch (error) {
    logger.error(`Channel ${action} error:`, error);
    await interaction.editReply({
      content: `❌ Failed to ${action} channels: ${error.message}`
    });
  }
}

/**
 * Handle permissions update
 */
async function handlePermissions(interaction, guild) {
  const resetAll = interaction.options.getBoolean('reset_all') ?? false;

  await interaction.reply({
    content: `🔄 Verifying roles and updating permissions${resetAll ? ' (resetting first)' : ''}...`,
    ephemeral: false
  });

  // Import the existing permission update logic
  const { updateChannelPermissions } = require('../utils/permissionManager');

  try {
    // First, verify all required roles exist
    const missingRoles = [];
    const foundRoles = [];
    
    for (const roleName of centralConfig.requiredRoles) {
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (!role) {
        missingRoles.push(roleName);
      } else {
        foundRoles.push(`${roleName} (ID: ${role.id})`);
      }
    }

    // If there are missing roles, warn but continue
    if (missingRoles.length > 0) {
      logger.warn('Missing required roles:', missingRoles);
      await interaction.editReply({
        content: `⚠️ **Warning: Missing Patreon Roles**\n\nThe following roles must exist for permissions to work:\n${missingRoles.map(r => `• \`${r}\``).join('\n')}\n\n**These roles are created by Patreon's Discord Linked Roles.**\nEnsure Linked Roles integration is configured.\n\n✅ Found roles:\n${foundRoles.map(r => `• ${r}`).join('\n')}\n\nContinuing with permission update...`
      });
      
      // Wait 5 seconds for admin to read
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const results = {
      updated: [],
      missing: [],
      errors: [],
      rolesFound: foundRoles.length,
      rolesMissing: missingRoles.length,
    };

    // Process each category and its channels
    for (const categoryConfig of centralConfig.categories) {
      const category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === categoryConfig.name
      );

      if (!category) {
        results.missing.push(`Category: ${categoryConfig.name}`);
        continue;
      }

      try {
        await updateChannelPermissions(category, categoryConfig, guild, resetAll);
        results.updated.push(`Category: ${category.name}`);
      } catch (error) {
        logger.error(`Failed to update category ${category.name}:`, error);
        results.errors.push(`Category: ${category.name} - ${error.message}`);
      }

      // Update channels in this category
      for (const channelName of categoryConfig.channels) {
        const channel = guild.channels.cache.find(
          c => c.type === ChannelType.GuildText && 
               c.name === channelName && 
               c.parentId === category.id
        );

        if (!channel) {
          results.missing.push(`Channel: ${channelName}`);
          continue;
        }

        try {
          const channelPerms = centralConfig.channelPermissions?.[channelName];
          const configToUse = channelPerms 
            ? { ...categoryConfig, permissions: channelPerms }
            : categoryConfig;
          
          await updateChannelPermissions(channel, configToUse, guild, resetAll);
          results.updated.push(`Channel: ${channel.name}`);
        } catch (error) {
          logger.error(`Failed to update channel ${channel.name}:`, error);
          results.errors.push(`Channel: ${channel.name} - ${error.message}`);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🔧 GCC Permissions Update Complete')
      .setColor(results.errors.length > 0 || results.rolesMissing > 0 ? 0xff9900 : 0x00ff00)
      .setTimestamp();

    // Role verification summary
    embed.addFields({
      name: '🎭 Role Verification',
      value: `Found: ${results.rolesFound}/${results.rolesFound + results.rolesMissing} required roles${results.rolesMissing > 0 ? `\n⚠️ Missing: ${results.rolesMissing} roles (see warning above)` : ''}`,
      inline: false,
    });

    if (results.updated.length > 0) {
      embed.addFields({
        name: '✅ Updated Successfully',
        value: results.updated.slice(0, 10).join('\n') + 
               (results.updated.length > 10 ? `\n... and ${results.updated.length - 10} more` : ''),
        inline: false,
      });
    }

    if (results.missing.length > 0) {
      embed.addFields({
        name: '⚠️ Missing Channels',
        value: results.missing.slice(0, 5).join('\n') + 
               (results.missing.length > 5 ? `\n... and ${results.missing.length - 5} more` : ''),
        inline: false,
      });
    }

    if (results.errors.length > 0) {
      embed.addFields({
        name: '❌ Errors',
        value: results.errors.slice(0, 5).join('\n') + 
               (results.errors.length > 5 ? `\n... and ${results.errors.length - 5} more` : ''),
        inline: false,
      });
    }

    await interaction.editReply({ content: null, embeds: [embed] });
  } catch (error) {
    logger.error('Permission update error:', error);
    await interaction.editReply({
      content: `❌ Failed to update permissions: ${error.message}`
    });
  }
}

/**
 * Helper functions for content population
 */
async function populateChannel(guild, channelName, repopulate) {
  const channel = guild.channels.cache.find(c => c.name === channelName);
  if (!channel) {
    return `⚠️ Channel #${channelName} not found`;
  }

  const content = centralConfig.starterMessages[channelName];
  if (!content) {
    return `⚠️ No starter message defined for #${channelName}`;
  }

  // Repopulate: clear existing bot messages
  if (repopulate) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const botMessages = messages.filter(m => m.author.bot);
    if (botMessages.size > 0) {
      await channel.bulkDelete(botMessages);
      logger.info(`Cleared ${botMessages.size} bot messages from #${channelName}`);
    }
  }

  // Send new message
  await channel.send(content);
  return `✅ ${channelName} populated`;
}

async function populateWelcome(guild, repopulate) {
  return await populateChannel(guild, 'start-here', repopulate);
}

async function populateRules(guild, repopulate) {
  // Populate both announcements and faq-docs
  const results = [];
  results.push(await populateChannel(guild, 'announcements', repopulate));
  results.push(await populateChannel(guild, 'faq-docs', repopulate));
  return results.join('\n');
}

async function populateBotInvites(guild, repopulate) {
  // Populate all bot invite channels
  const results = [];
  results.push(await populateChannel(guild, 'grizzly-bot-invite', repopulate));
  results.push(await populateChannel(guild, 'bot-release-notes', repopulate));
  return results.join('\n');
}

async function populateGrizzlyInvite(guild, repopulate) {
  return await populateChannel(guild, 'grizzly-bot-invite', repopulate);
}

async function populateAboutBots(guild, repopulate) {
  return await populateChannel(guild, 'bot-release-notes', repopulate);
}

async function populateHowToSubscribe(guild, repopulate) {
  // Separate channel for subscription info if it exists
  const channel = guild.channels.cache.find(c => c.name === 'how-to-subscribe');
  if (channel) {
    return await populateChannel(guild, 'how-to-subscribe', repopulate);
  }
  // Fallback to verify-linked-roles which contains subscription info
  return await populateChannel(guild, 'verify-linked-roles', repopulate);
}

async function populateVerifyPatreon(guild, repopulate) {
  const results = [];
  results.push(await populateChannel(guild, 'verify-linked-roles', repopulate));
  results.push(await populateChannel(guild, 'verification-help', repopulate));
  return results.join('\n');
}

async function setupAllChannels(guild) {
  const { configBootstrap } = require('../modules/configBootstrap.js');
  await configBootstrap('central', guild.id, guild.client);
  return 'All channels set up successfully';
}

async function fixAllChannels(guild) {
  const { validateConfig } = require('../modules/configValidator.js');
  await validateConfig(guild, 'central');
  return 'All channels validated and fixed';
}

async function cleanupChannels(guild) {
  let removed = 0;
  const configChannels = centralConfig.categories.flatMap(c => c.channels);
  
  // Protected channels that should never be deleted
  const protectedChannels = [
    'general', 'staff-chat', 'dev-testing', 'bot-commands',
    'audit-log', 'server-log', 'mod-log'
  ];
  
  const toRemove = [];
  
  for (const [id, channel] of guild.channels.cache) {
    if (channel.type === ChannelType.GuildText) {
      const isInConfig = configChannels.includes(channel.name);
      const isProtected = protectedChannels.includes(channel.name);
      const isFromBot = channel.topic?.includes('Grizzly Bot');
      
      // Only remove if: not in config, not protected, and created by bot
      if (!isInConfig && !isProtected && isFromBot) {
        toRemove.push(channel);
      }
    }
  }
  
  // Delete identified channels
  for (const channel of toRemove) {
    try {
      await channel.delete('GCC cleanup: channel not in config');
      removed++;
      logger.info(`Deleted unused channel: ${channel.name}`);
    } catch (error) {
      logger.error(`Failed to delete channel ${channel.name}:`, error);
    }
  }
  
  return `Removed ${removed} unused bot-created channels (${toRemove.length - removed} failed)`;
}

async function updateChannelInfo(guild) {
  let updated = 0;
  
  for (const category of centralConfig.categories) {
    const cat = guild.channels.cache.find(c => c.name === category.name && c.type === ChannelType.GuildCategory);
    if (!cat) continue;
    
    for (const channelName of category.channels) {
      const channel = guild.channels.cache.find(c => c.name === channelName && c.parentId === cat.id);
      if (!channel) continue;
      
      // Update topic if defined
      if (centralConfig.channelTopics && centralConfig.channelTopics[channelName]) {
        await channel.setTopic(centralConfig.channelTopics[channelName]);
        updated++;
      }
    }
  }
  
  return `Updated info for ${updated} channels`;
}
