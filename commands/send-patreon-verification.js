const {
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
} = require('discord.js');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send-patreon-verification')
    .setDescription('Send professional Patreon verification system to a channel (Admin only)')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send the verification system to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to use this command.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = interaction.options.getChannel('channel');

      // Clear existing messages first
      try {
        const messages = await channel.messages.fetch({ limit: 100 });
        if (messages.size > 0) {
          await channel.bulkDelete(messages);
          logger.info(`✅ Cleared ${messages.size} existing messages from ${channel.name}`);
        }
      } catch (clearError) {
        logger.warn('Could not clear existing messages:', clearError.message);
      }

      // Create professional verification button
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_patreon_subscription')
          .setLabel('🔐 Verify Patreon Subscription')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐')
      );

      // Single comprehensive professional verification embed
      const verificationEmbed = new EmbedBuilder()
        .setTitle('🔐 Patreon Subscription Verification')
        .setDescription('**Professional GCC Subscription Authentication**\n\nSecurely link your Patreon subscription to unlock premium features and access tier-appropriate channels.')
        .addFields([
          {
            name: '💎 Subscription Tiers & Pricing',
            value: '**🥉 Bronze - $6/month** - Core features and basic monitoring\n**🥈 Silver - $10/month** - Advanced features and website listing\n**🥇 Gold - $15/month** - Full access and priority support\n**💎 Partner - $20/month** - Enterprise solutions and custom features',
            inline: false,
          },
          {
            name: '✨ Verification Benefits',
            value: '• Automatic tier role assignment based on your subscription\n• Instant access to premium channels and features\n• Professional support through ticket system\n• Server monitoring and management tools',
            inline: false,
          },
          {
            name: '🔒 Secure OAuth2 Process',
            value: '• Click verification button below to start\n• Authenticate securely through Patreon OAuth2\n• Automatic subscription tier detection\n• Immediate role and permission updates',
            inline: false,
          },
          {
            name: '🎫 Professional Support',
            value: '• **Enterprise Setup:** Open a ticket for business solutions\n• **Technical Issues:** Open a ticket for immediate assistance\n• **Billing Support:** Patreon and subscription management help\n• **Community Help:** Support channels and documentation',
            inline: false,
          }
        ])
        .setColor(0xFFD700)
        .setThumbnail('https://cdn.discordapp.com/attachments/1056963130833506344/1391514726892429322/grizzly.png')
        .setFooter({ 
          text: 'Professional DayZ server management solutions for every need',
          iconURL: 'https://cdn.discordapp.com/attachments/1056963130833506344/1391514726892429322/grizzly.png'
        })
        .setTimestamp();

      // Send single comprehensive embed
      await channel.send({
        embeds: [verificationEmbed],
        components: [row],
      });

      await interaction.editReply({
        content: `✅ Professional Patreon verification system sent to ${channel}!\n\n**Features:**\n• **Single comprehensive embed** - All information in one place\n• **Professional design** - Consistent with GCC branding\n• **Complete tier information** - All subscription plans detailed\n• **Security information** - OAuth2 process explanation\n• **Support system integration** - Ticket-based assistance\n• **One-click verification** - Streamlined user experience\n• **Channel cleared** - Removed old messages for clean appearance`,
      });

      logger.info(`Admin ${interaction.user.tag} sent professional Patreon verification system to ${channel.name}`);

    } catch (error) {
      logger.error('Send Patreon verification error:', error);
      await interaction.editReply({
        content: '❌ Failed to send Patreon verification system. Please check permissions and try again.',
      });
    }
  },
};
