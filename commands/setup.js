const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const logger = require('../modules/logger');
const { configBootstrap } = require('../modules/configBootstrap.js');
const { pool } = require('../modules/db');
const { checkGuildSubscription } = require('../utils/subscriptionGuard.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup server components and features')
    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Initialize server configuration (auto-detects GCC or subscriber)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rules')
        .setDescription('Setup server rules with agreement button')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to post the rules in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('rules')
            .setDescription('Your server rules (use \\n for new lines)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Title for the rules message (default: Server Rules)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('link-channel')
        .setDescription('Set up the character linking channel and roles')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('satellite-channel')
        .setDescription('Setup a satellite channel for external server')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to setup as satellite')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'server':
          await handleServerSetup(interaction);
          break;
        case 'rules':
          await handleRulesSetup(interaction);
          break;
        case 'link-channel':
          await handleLinkChannelSetup(interaction);
          break;
        case 'satellite-channel':
          await handleSatelliteSetup(interaction);
          break;
      }
    } catch (error) {
      logger.error(`Error in setup ${subcommand}:`, error);
      const reply = {
        content: `❌ **Setup Error**\n\n${error.message}`,
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
 * Handle server setup (auto-detects GCC vs subscriber)
 */
async function handleServerSetup(interaction) {
  const isGCC = interaction.guild.id === process.env.GRIZZLY_COMMAND_GUILD_ID;
  const serverType = isGCC ? 'central' : 'subscriber';
  const serverName = isGCC ? 'Grizzly Command Central' : 'your subscriber server';

  // GCC setup - no subscription required
  if (isGCC) {
    await interaction.reply({ 
      content: `🏗️ Setting up ${serverName}...`, 
      ephemeral: true 
    });

    const result = await configBootstrap(interaction.guild, serverType);
    
    await interaction.editReply(
      result 
        ? `✅ GCC setup complete!` 
        : `❌ Setup failed. Check logs.`
    );
    return;
  }

  // Subscriber server - verify subscription
  await interaction.deferReply({ ephemeral: true });
  
  const guildOwner = await interaction.guild.fetchOwner();
  const subscriptionCheck = await checkGuildSubscription(interaction.guild.id, guildOwner.id);

  if (!subscriptionCheck.allowed) {
    return interaction.editReply({
      content: subscriptionCheck.message
    });
  }

  // Subscription verified - proceed with setup
  await interaction.editReply({ 
    content: `🏗️ Setting up ${serverName}...\n${subscriptionCheck.message}`
  });

  const result = await configBootstrap(interaction.guild, serverType);
  
  await interaction.editReply(
    result 
      ? `✅ Subscriber server setup complete!\n\n**${subscriptionCheck.message}**\n\n**🚀 Connect Nitrado:**\nUse \`/nitrado-auth add-token\` with your Nitrado API token and service ID.\n\n**⚡ Auto-Start Features:**\nOnce connected, all monitoring will start automatically:\n• 🛰️ Satellite feed (live player tracking)\n• 💀 Kill feed (PvP events)\n• 🚪 Connections feed (join/leave)\n• 🏠 PvE events (building/raiding)\n• 📊 All other feeds configured` 
      : `❌ Setup failed. Check logs.`
  );
}

/**
 * Handle rules setup
 */
async function handleRulesSetup(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: '❌ You need Administrator permissions to setup server rules.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel('channel');
  const rulesText = interaction.options.getString('rules').replace(/\\n/g, '\n');
  const title = interaction.options.getString('title') || 'Server Rules';

  try {
    // Ensure the Player role exists
    let playerRole = interaction.guild.roles.cache.find(r => r.name === 'Player');
    if (!playerRole) {
      playerRole = await interaction.guild.roles.create({
        name: 'Player',
        mentionable: true,
        reason: 'Required role for server access',
      });
      logger.info(`Created Player role in ${interaction.guild.name}`);
    }

    // Create the rules embed
    const rulesEmbed = {
      title: `📋 ${title}`,
      description:
        rulesText +
        '\n\n**📝 To access the server:**\nClick the "I Agree to Rules" button below to confirm you understand and will follow all server rules.',
      color: 0x00ff00,
      footer: {
        text: 'By clicking "I Agree to Rules", you agree to follow all server rules and may be subject to punishment for violations.',
      },
    };

    // Create the agreement button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('agree_rules')
        .setLabel('I Agree to Rules')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

    // Send the rules message
    await channel.send({
      embeds: [rulesEmbed],
      components: [row],
    });

    await interaction.editReply({
      content: (() => {
        const isGCC = interaction.guild.id === process.env.GRIZZLY_COMMAND_GUILD_ID;
        if (isGCC) {
          return `✅ Professional rules have been posted in ${channel}!\n\n**Automated Role Assignment:**\n• Players click "I Agree to Rules" for tier-based access\n• **Patreon Subscribers:** Automatically receive Bronze/Silver/Gold/Partner roles\n• **Non-Subscribers:** Receive Supporter role for basic channel access\n• **Channel Permissions:** Roles control access to premium channels\n• Users can click the verification button in #verify-patreon to upgrade their subscription tier`;
        } else {
          return `✅ Professional rules have been posted in ${channel}!\n\n**Automated Role Assignment:**\n• Players click "I Agree to Rules" to receive the Player role\n• **Player Role:** Grants access to subscriber channels and features\n• **Channel Permissions:** Role required for most channel access\n• You can customize role permissions in Discord server settings`;
        }
      })(),
    });

    logger.info(
      `Admin ${interaction.user.tag} set up server rules in ${channel.name} for guild ${interaction.guild.name}`
    );
  } catch (error) {
    logger.error('Setup rules error:', error);
    await interaction.editReply({
      content: '❌ Failed to setup server rules. Please check bot permissions and try again.',
    });
  }
}

/**
 * Handle link channel setup
 */
async function handleLinkChannelSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;

    // Create link channel if it doesn't exist
    let linkChannel = guild.channels.cache.find(c => c.name === 'link-character');
    if (!linkChannel) {
      linkChannel = await guild.channels.create({
        name: 'link-character',
        type: 0, // Text channel
        topic: 'Link your Discord account to your in-game character using /link-character',
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: ['ViewChannel', 'SendMessages', 'UseApplicationCommands'],
            deny: ['SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads']
          }
        ]
      });
      logger.info('Created link-character channel');
    }

    // Create verification requests channel if it doesn't exist
    let verificationChannel = guild.channels.cache.find(c => c.name === 'verification-requests');
    if (!verificationChannel) {
      verificationChannel = await guild.channels.create({
        name: 'verification-requests',
        type: 0, // Text channel
        topic: 'Staff channel for managing character link verification requests',
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: ['ViewChannel']
          },
        ]
      });
      logger.info('Created verification-requests channel');
    }

    // Create required roles
    const rolesToCreate = [
      { name: 'Linked Player', color: 0x95a5a6, description: 'Players who have linked their character (unverified)' },
      { name: 'Verified Player', color: 0x27ae60, description: 'Players whose character link has been verified' }
    ];

    const createdRoles = [];
    for (const roleData of rolesToCreate) {
      let role = guild.roles.cache.find(r => r.name === roleData.name);
      if (!role) {
        role = await guild.roles.create({
          name: roleData.name,
          color: roleData.color,
          mentionable: true,
          reason: `Character linking system: ${roleData.description}`,
        });
        createdRoles.push(roleData.name);
        logger.info(`Created ${roleData.name} role`);
      }
    }

    // Send informational message to link channel
    const linkEmbed = new EmbedBuilder()
      .setTitle('🔗 Character Linking System')
      .setDescription('Link your Discord account to your in-game character to gain full server access!')
      .setColor(0x3498db)
      .addFields([
        {
          name: '📋 How to Link Your Character',
          value: '1. Use `/link-character` command with your exact in-game name\n2. Wait for automatic verification (when you\'re online)\n3. Or wait for manual staff approval\n4. Receive your verified player role!',
          inline: false
        },
        {
          name: '✅ Benefits of Linking',
          value: '• Access to enhanced bot features\n• Player statistics tracking\n• Full server permissions\n• Economy system participation',
          inline: false
        },
        {
          name: '⚠️ Important Notes',
          value: '• Use your **exact** character name (case-sensitive)\n• You can only link one character per server\n• Character names cannot be changed once verified',
          inline: false
        }
      ])
      .setFooter({ text: 'Questions? Contact server staff for assistance.' })
      .setTimestamp();

    await linkChannel.send({ embeds: [linkEmbed] });

    // Send setup confirmation
    const setupEmbed = new EmbedBuilder()
      .setTitle('✅ Link Channel Setup Complete')
      .setColor(0x27ae60)
      .addFields([
        { name: 'Link Channel', value: `<#${linkChannel.id}>`, inline: true },
        { name: 'Verification Channel', value: `<#${verificationChannel.id}>`, inline: true },
        { name: 'Roles Created', value: createdRoles.length > 0 ? createdRoles.join(', ') : 'All roles already existed', inline: false }
      ])
      .setFooter({ text: 'Players can now use /link-character in the link channel!' });

    await interaction.editReply({ embeds: [setupEmbed] });

  } catch (error) {
    logger.error('Link channel setup error:', error);
    await interaction.editReply({
      content: '❌ Failed to set up link channel. Check bot permissions and try again.',
    });
  }
}

/**
 * Handle satellite channel setup
 */
async function handleSatelliteSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guildId = interaction.guildId;
    let channel = interaction.options.getChannel('channel');

    // If no channel specified, look for #satellite or create it
    if (!channel) {
      channel = interaction.guild.channels.cache.find(c => c.name === 'satellite');
      
      if (!channel) {
        try {
          channel = await interaction.guild.channels.create({
            name: 'satellite',
            type: ChannelType.GuildText,
            topic: '📊 Live player status and join/leave notifications',
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone,
                deny: [PermissionFlagsBits.SendMessages],
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
              }
            ]
          });
        } catch (createError) {
          return interaction.editReply({
            content: `❌ Failed to create satellite channel: ${createError.message}`,
          });
        }
      }
    }

    // Store satellite channel in database
    await pool.query(
      `INSERT INTO guild_channels (guild_id, satellite_channel_id) 
       VALUES ($1, $2) 
       ON CONFLICT (guild_id) 
       DO UPDATE SET satellite_channel_id = $2`,
      [guildId, channel.id]
    );

    // Create initial satellite dashboard
    await createSatelliteDashboard(channel, interaction.guild);

    const embed = new EmbedBuilder()
      .setTitle('📊 Player Status Feed Setup Complete')
      .setDescription(`Player status feed has been configured in ${channel}`)
      .addFields(
        {
          name: '📊 Features Enabled',
          value: '• Real-time online player list\n• Join/Leave notifications',
          inline: false
        },
        {
          name: '🔧 Next Steps',
          value: '• Connect your Nitrado server via `/register-server`\n• Feed will auto-start when server is connected',
          inline: false
        }
      )
      .setColor(0x00ff88)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.info(`✅ Player status feed setup completed for guild ${guildId}`);

  } catch (error) {
    logger.error('Setup satellite channel error:', error);
    await interaction.editReply({
      content: `❌ Error setting up satellite channel: ${error.message}`,
    });
  }
}

async function createSatelliteDashboard(channel, guild) {
  try {
    // Clear existing messages
    const messages = await channel.messages.fetch({ limit: 10 });
    if (messages.size > 0) {
      await channel.bulkDelete(messages);
    }

    // Create simple initial embed
    const embed = new EmbedBuilder()
      .setTitle('📊 Players Online')
      .setDescription('*Waiting for server connection...*')
      .setColor(0x666666)
      .setTimestamp()
      .setFooter({ text: 'Updates every 30 seconds' });

    await channel.send({ embeds: [embed] });

    // Create simple info message
    const infoEmbed = new EmbedBuilder()
      .setTitle('📋 Player Status Feed Info')
      .setDescription('This channel shows online players and join/leave notifications.')
      .addFields(
        {
          name: '⚙️ Requirements:',
          value: '• Nitrado server must be connected\n• Feed will auto-start when server is connected',
          inline: false
        }
      )
      .setColor(0x0099ff);

    await channel.send({ embeds: [infoEmbed] });

  } catch (error) {
    logger.error('Error creating satellite dashboard:', error);
  }
}
