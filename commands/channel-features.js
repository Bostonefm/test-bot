
const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel-features')
    .setDescription('Manage advanced channel features')
    .addSubcommand(subcommand =>
      subcommand
        .setName('auto-messages')
        .setDescription('Setup automated messages for channels')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Target channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Message type')
            .addChoices(
              { name: 'Welcome Message', value: 'welcome' },
              { name: 'Channel Description', value: 'description' },
              { name: 'Rules & Guidelines', value: 'rules' },
              { name: 'Feature Instructions', value: 'instructions' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reaction-roles')
        .setDescription('Setup reaction role system')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Target channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Message content for reaction roles')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed-setup')
        .setDescription('Create information embeds')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Target channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('template')
            .setDescription('Embed template')
            .addChoices(
              { name: 'Server Information', value: 'server_info' },
              { name: 'Bot Commands', value: 'bot_commands' },
              { name: 'Economy System', value: 'economy' },
              { name: 'DayZ Features', value: 'dayz_features' },
              { name: 'Support Information', value: 'support' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel-sync')
        .setDescription('Sync channel permissions and settings')
        .addChannelOption(option =>
          option
            .setName('source')
            .setDescription('Source channel to copy from')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('target')
            .setDescription('Target channel to apply to')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('sync_type')
            .setDescription('What to sync')
            .addChoices(
              { name: 'Permissions Only', value: 'permissions' },
              { name: 'Settings Only', value: 'settings' },
              { name: 'Everything', value: 'all' }
            )
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),

  async execute(interaction) {
    if (interaction.replied || interaction.deferred) return;

    try {
      await interaction.deferReply();
    } catch (error) {
      logger.error('Failed to defer reply:', error);
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'auto-messages':
          await handleAutoMessages(interaction);
          break;
        case 'reaction-roles':
          await handleReactionRoles(interaction);
          break;
        case 'embed-setup':
          await handleEmbedSetup(interaction);
          break;
        case 'channel-sync':
          await handleChannelSync(interaction);
          break;
        default:
          await interaction.editReply('❌ Unknown subcommand.');
      }
    } catch (error) {
      logger.error('Error in channel-features command:', error);
      await interaction.editReply('❌ An error occurred while managing channel features.');
    }
  }
};

async function handleAutoMessages(interaction) {
  const channel = interaction.options.getChannel('channel');
  const messageType = interaction.options.getString('type');
  
  const messages = getAutoMessages(interaction.guild.id === process.env.GRIZZLY_COMMAND_GUILD_ID);
  const messageContent = messages[messageType];

  if (!messageContent) {
    await interaction.editReply('❌ Message template not found.');
    return;
  }

  try {
    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setDescription(messageContent)
      .setTimestamp();

    // Add different styling based on message type
    switch (messageType) {
      case 'welcome':
        embed.setTitle('🎉 Welcome!')
              .setThumbnail(interaction.guild.iconURL());
        break;
      case 'description':
        embed.setTitle(`📋 ${channel.name}`)
              .setFooter({ text: 'Channel Information' });
        break;
      case 'rules':
        embed.setTitle('📜 Rules & Guidelines')
              .setColor(0xFF6B6B);
        break;
      case 'instructions':
        embed.setTitle('💡 How to Use This Channel')
              .setColor(0x4ECDC4);
        break;
    }

    await channel.send({ embeds: [embed] });

    await interaction.editReply(
      `✅ **Auto-message sent successfully!**\n\n` +
      `💬 **Channel:** ${channel}\n` +
      `📝 **Type:** ${messageType}\n` +
      `🎯 **Status:** Message posted`
    );

  } catch (error) {
    logger.error('Failed to send auto-message:', error);
    await interaction.editReply('❌ Failed to send message. Check bot permissions in target channel.');
  }
}

async function handleReactionRoles(interaction) {
  const channel = interaction.options.getChannel('channel');
  const messageContent = interaction.options.getString('message');

  try {
    const embed = new EmbedBuilder()
      .setTitle('🎭 Reaction Roles')
      .setDescription(messageContent)
      .setColor(0x9B59B6)
      .setFooter({ text: 'React below to get roles!' })
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });

    // Add common reaction emojis
    const reactions = ['✅', '🎮', '🛡️', '💰', '📊', '🔧'];
    
    for (const emoji of reactions) {
      try {
        await message.react(emoji);
      } catch (error) {
        logger.error(`Failed to add reaction ${emoji}:`, error);
      }
    }

    await interaction.editReply(
      `✅ **Reaction role system setup!**\n\n` +
      `💬 **Channel:** ${channel}\n` +
      `📝 **Message ID:** ${message.id}\n` +
      `🎯 **Reactions Added:** ${reactions.length}\n\n` +
      `ℹ️ **Next Steps:**\n` +
      `• Configure role assignments in server settings\n` +
      `• Test reactions to ensure proper functionality`
    );

  } catch (error) {
    logger.error('Failed to setup reaction roles:', error);
    await interaction.editReply('❌ Failed to setup reaction roles. Check bot permissions.');
  }
}

async function handleEmbedSetup(interaction) {
  const channel = interaction.options.getChannel('channel');
  const template = interaction.options.getString('template');
  
  const embeds = getEmbedTemplates(interaction.guild.id === process.env.GRIZZLY_COMMAND_GUILD_ID);
  const embedConfig = embeds[template];

  if (!embedConfig) {
    await interaction.editReply('❌ Embed template not found.');
    return;
  }

  try {
    const embed = new EmbedBuilder()
      .setTitle(embedConfig.title)
      .setDescription(embedConfig.description)
      .setColor(embedConfig.color || 0x00AE86)
      .setTimestamp();

    if (embedConfig.thumbnail) {
      embed.setThumbnail(embedConfig.thumbnail);
    }

    if (embedConfig.fields) {
      embed.addFields(embedConfig.fields);
    }

    if (embedConfig.footer) {
      embed.setFooter({ text: embedConfig.footer });
    }

    let components = [];
    if (embedConfig.buttons) {
      const row = new ActionRowBuilder();
      for (const button of embedConfig.buttons) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel(button.label)
            .setStyle(button.style || ButtonStyle.Primary)
            .setCustomId(button.customId || `btn_${Date.now()}`)
            .setEmoji(button.emoji || '🔗')
        );
      }
      components.push(row);
    }

    const messageOptions = { embeds: [embed] };
    if (components.length > 0) {
      messageOptions.components = components;
    }

    await channel.send(messageOptions);

    await interaction.editReply(
      `✅ **Embed created successfully!**\n\n` +
      `💬 **Channel:** ${channel}\n` +
      `🎨 **Template:** ${template}\n` +
      `📝 **Features:** ${embedConfig.fields ? embedConfig.fields.length : 0} fields, ` +
      `${embedConfig.buttons ? embedConfig.buttons.length : 0} buttons`
    );

  } catch (error) {
    logger.error('Failed to create embed:', error);
    await interaction.editReply('❌ Failed to create embed. Check bot permissions.');
  }
}

async function handleChannelSync(interaction) {
  const sourceChannel = interaction.options.getChannel('source');
  const targetChannel = interaction.options.getChannel('target');
  const syncType = interaction.options.getString('sync_type');

  try {
    let syncedItems = 0;

    if (syncType === 'permissions' || syncType === 'all') {
      // Copy permission overwrites
      const permissions = sourceChannel.permissionOverwrites.cache.map(overwrite => ({
        id: overwrite.id,
        allow: overwrite.allow.toArray(),
        deny: overwrite.deny.toArray(),
        type: overwrite.type
      }));

      await targetChannel.permissionOverwrites.set(permissions);
      syncedItems++;
    }

    if (syncType === 'settings' || syncType === 'all') {
      // Copy channel settings
      const updates = {};
      
      if (sourceChannel.topic !== targetChannel.topic) {
        updates.topic = sourceChannel.topic;
      }
      
      if (sourceChannel.nsfw !== targetChannel.nsfw) {
        updates.nsfw = sourceChannel.nsfw;
      }
      
      if (sourceChannel.rateLimitPerUser !== targetChannel.rateLimitPerUser) {
        updates.rateLimitPerUser = sourceChannel.rateLimitPerUser;
      }

      if (Object.keys(updates).length > 0) {
        await targetChannel.edit(updates);
        syncedItems += Object.keys(updates).length;
      }
    }

    await interaction.editReply(
      `✅ **Channel sync completed!**\n\n` +
      `📤 **Source:** ${sourceChannel}\n` +
      `📥 **Target:** ${targetChannel}\n` +
      `⚙️ **Sync Type:** ${syncType}\n` +
      `🔄 **Items Synced:** ${syncedItems}`
    );

  } catch (error) {
    logger.error('Failed to sync channels:', error);
    await interaction.editReply('❌ Failed to sync channels. Check bot permissions.');
  }
}

function getAutoMessages(isGCC) {
  if (isGCC) {
    return {
      welcome: '🎮 **Welcome to Grizzly Command Central**\n\nYour professional hub for DayZ server management and bot services. Use `/verify-patreon` to unlock premium features!',
      description: 'This channel contains important information about our services and features.',
      rules: '📋 **Community Guidelines**\n\n1. Be respectful to all members\n2. No spam or self-promotion\n3. Use appropriate channels\n4. Follow Discord ToS',
      instructions: '💡 **How to get started:**\n• Subscribe to our Patreon\n• Use `/verify-patreon` to link your account\n• Explore our bot features'
    };
  } else {
    return {
      welcome: '🎉 **Welcome to the server!**\n\nThis is your DayZ community hub with Grizzly Bot integration.',
      description: 'This channel provides information about server features and gameplay.',
      rules: '📜 **Server Rules**\n\n• Follow all server guidelines\n• Respect other players\n• Use channels appropriately',
      instructions: '🎮 **Getting Started:**\n• Use `/link-player` to connect your character\n• Check `/player-stats` for your progress\n• Explore economy features'
    };
  }
}

function getEmbedTemplates(isGCC) {
  const common = {
    server_info: {
      title: '🏠 Server Information',
      description: 'Welcome to our community! Here\'s everything you need to know.',
      color: 0x3498DB,
      fields: [
        { name: '👥 Community', value: 'Active and friendly playerbase', inline: true },
        { name: '🎮 Game Focus', value: 'DayZ Console Servers', inline: true },
        { name: '🤖 Bot Features', value: 'Advanced server management', inline: true }
      ],
      footer: 'Updated regularly with new information'
    },
    support: {
      title: '🆘 Support Center',
      description: 'Need help? We\'re here to assist you!',
      color: 0xE74C3C,
      fields: [
        { name: '📞 Contact', value: 'Tag <@Boston781> for assistance', inline: false },
        { name: '🎫 Tickets', value: 'Use the Assistant Bot for support tickets', inline: false }
      ],
      buttons: [
        { label: 'Open Ticket', customId: 'support_ticket', emoji: '🎫' }
      ]
    }
  };

  if (isGCC) {
    return {
      ...common,
      bot_commands: {
        title: '🤖 Grizzly Bot Commands',
        description: 'Complete command reference for premium subscribers',
        color: 0x9B59B6,
        fields: [
          { name: '🔗 Setup', value: '`/verify-patreon` - Link subscription', inline: true },
          { name: '📊 Monitoring', value: '`/start-monitoring` - Begin logs', inline: true },
          { name: '💰 Economy', value: '`/economy` - Manage coins', inline: true }
        ]
      },
      economy: {
        title: '💰 GCC Subscription Tiers',
        description: 'Choose your perfect plan for DayZ server management',
        color: 0xF1C40F,
        fields: [
          { name: '🥉 Bronze - $6/month', value: 'Bot access, kill feeds, basic tracking', inline: false },
          { name: '🥈 Silver - $10/month', value: 'Bronze + website listing', inline: false },
          { name: '🥇 Gold - $15/month', value: 'Silver + featured listing', inline: false },
          { name: '💎 Partner - $20/month', value: 'Exclusive partnership benefits', inline: false }
        ],
        buttons: [
          { label: 'Subscribe Now', customId: 'patreon_link', emoji: '💎' }
        ]
      }
    };
  } else {
    return {
      ...common,
      bot_commands: {
        title: '🎮 Player Commands',
        description: 'Available commands for server members',
        color: 0x2ECC71,
        fields: [
          { name: '🔗 Character', value: '`/link-player` - Connect character', inline: true },
          { name: '📊 Stats', value: '`/player-stats` - View progress', inline: true },
          { name: '💰 Economy', value: '`/economy balance` - Check coins', inline: true }
        ]
      },
      economy: {
        title: '💰 Grizzly Coins Economy',
        description: 'Earn and spend coins in our server economy',
        color: 0xF39C12,
        fields: [
          { name: '💵 Earn Coins', value: 'Play on server, complete quests', inline: true },
          { name: '🛒 Spend Coins', value: 'Buy items, services, perks', inline: true },
          { name: '📈 Leaderboard', value: 'Compete with other players', inline: true }
        ]
      },
      dayz_features: {
        title: '🧟 DayZ Server Features',
        description: 'Enhanced gameplay with Grizzly Bot integration',
        color: 0x8E44AD,
        fields: [
          { name: '💀 Kill Feed', value: 'Live PvP notifications', inline: true },
          { name: '🏛️ Factions', value: 'Territory control system', inline: true },
          { name: '📊 Statistics', value: 'Detailed player tracking', inline: true },
          { name: '🎯 Quests', value: 'Daily and weekly challenges', inline: true }
        ]
      }
    };
  }
}
