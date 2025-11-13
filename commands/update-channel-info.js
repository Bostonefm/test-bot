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
    .setName('gcc-update-channel-info')
    .setDescription('GCC: Update or create channels with fresh information and correct permissions')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to update')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    try {
      // Check if interaction is still valid before deferring
      if (interaction.deferred || interaction.replied) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const targetChannel = interaction.options.getChannel('channel');

      // Detect if this is GCC or a subscriber server
      const isGCC = guild.id === process.env.GRIZZLY_COMMAND_GUILD_ID;
      const config = isGCC ? centralConfig : subscriberConfig;

      logger.info(`Updating channel info for: ${targetChannel.name} in ${guild.name}`);

      // Find the channel name in our config
      const channelName = targetChannel.name;
      let channelFound = false;

      // Check if channel exists in any category
      for (const categoryConfig of config.categories) {
        if (categoryConfig.channels.includes(channelName)) {
          channelFound = true;
          break;
        }
      }

      if (!channelFound) {
        return await interaction.editReply({
          content: `❌ **Channel Not Recognized**\n\nThe channel \`${channelName}\` is not part of the bot's managed channels. Only channels created by \`/setup-channels\` can be updated.`,
        });
      }

      // Clear recent bot messages (last 10 messages)
      try {
        const messages = await targetChannel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(msg => msg.author.id === interaction.client.user.id);

        if (botMessages.size > 0) {
          logger.info(`Clearing ${botMessages.size} bot messages from ${channelName}`);
          await targetChannel.bulkDelete(botMessages);
        }
      } catch (error) {
        logger.warn(`Could not clear old messages in ${channelName}:`, error.message);
      }

      // Send starter message if defined
      if (config.starterMessages && config.starterMessages[channelName]) {
        await targetChannel.send(config.starterMessages[channelName]);
      }

      // Populate channel with updated content using the same function from setup-channels
      await populateChannelContent(targetChannel, channelName, guild, isGCC);

      const embed = new EmbedBuilder()
        .setTitle('✅ Channel Updated Successfully')
        .setDescription(`Updated information and content for ${targetChannel}`)
        .addFields([
          {
            name: '📝 Actions Taken',
            value:
              '• Cleared old bot messages\n• Added fresh starter message\n• Populated with latest content\n• Updated channel information',
            inline: false,
          },
          {
            name: '🔄 Next Steps',
            value: 'The channel now contains the most current information and formatting.',
            inline: false,
          },
        ])
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Successfully updated channel: ${channelName}`);

    } catch (error) {
      logger.error('Error in update-channel-info:', error);

      // Only try to respond if interaction hasn't expired
      if (!interaction.deferred && !interaction.replied) {
        try {
          await interaction.reply({
            content: '❌ There was an error updating the channel information.',
            ephemeral: true
          });
        } catch (replyError) {
          logger.error('Failed to send error reply:', replyError);
        }
      } else if (interaction.deferred) {
        try {
          await interaction.editReply({
            content: '❌ There was an error updating the channel information.',
          });
        } catch (editError) {
          logger.error('Failed to edit deferred reply:', editError);
        }
      }
    }
  }
};

// Import the populateChannelContent function from setup-channels
async function populateChannelContent(channel, channelName, guild, isGCC) {
  try {
    const embed = new EmbedBuilder()
      .setTitle(
        `🔄 ${channelName.charAt(0).toUpperCase() + channelName.slice(1).replace(/-/g, ' ')}`
      )
      .setDescription('This channel has been updated with the latest information.')
      .setColor(0x0099ff)
      .setTimestamp();

    switch (channelName) {
      case 'server-updates':
        embed
          .setTitle('📢 Server Updates')
          .setDescription('Official server announcements and updates from administrators.')
          .addFields([
            {
              name: '📋 What Gets Posted Here',
              value:
                '• Server restart notifications\n• Maintenance announcements\n• Rule changes and updates\n• Important server information\n• Event announcements',
              inline: false,
            },
            {
              name: '🔒 Admin Only',
              value: 'Only administrators can post in this channel to ensure clear communication.',
              inline: false,
            },
          ]);
        break;

      case 'economy':
        embed
          .setTitle('💰 Grizzly Coins Economy')
          .setDescription('Virtual currency system for your DayZ server.')
          .addFields([
            {
              name: '💎 Earning Coins',
              value:
                '• Playing on the server\n• Completing challenges\n• Trading with players\n• Admin rewards',
              inline: false,
            },
            {
              name: '🛒 Spending Coins',
              value: '• Server shop items\n• Player trades\n• Special perks\n• Custom rewards',
              inline: false,
            },
          ]);
        break;

      case 'killfeed':
        embed
          .setTitle('💀 PvP Kill Feed')
          .setDescription('Real-time PvP combat notifications.')
          .addFields([
            {
              name: '⚔️ Combat Info',
              value:
                '• Player vs Player kills\n• Weapons used\n• Kill locations\n• Combat statistics',
              inline: false,
            },
          ]);
        break;

      case 'open-chat':
        embed
          .setTitle('💬 Open Community Chat')
          .setDescription('General discussion area for community interaction.')
          .addFields([
            {
              name: '🗣️ Great for:',
              value:
                '• Casual conversation\n• Sharing experiences\n• Community networking\n• General discussion',
              inline: false,
            },
          ]);
        break;

      case 'support-chat':
        embed
          .setTitle('🆘 Community Support Chat')
          .setDescription('Get help and ask questions from the community.')
          .addFields([
            {
              name: '❓ Ask about:',
              value:
                '• Bot usage questions\n• Technical help\n• Server issues\n• General assistance',
              inline: false,
            },
          ]);
        break;

      default:
        embed.setDescription(`Channel information updated for ${channelName}.`);
        break;
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.warn(`Failed to populate ${channelName}:`, error);
  }
}
