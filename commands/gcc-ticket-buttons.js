const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../config/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gcc-ticket-buttons')
    .setDescription('Add ticket buttons to GCC channels (Developer only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('support')
        .setDescription('Add support ticket button to open-a-ticket channel')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('feedback')
        .setDescription('Add feedback ticket button to patreon-feedback channel')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'support') {
        await handleSupportButton(interaction);
      } else if (subcommand === 'feedback') {
        await handleFeedbackButton(interaction);
      }
    } catch (error) {
      logger.error(`Error in gcc-ticket-buttons ${subcommand}:`, error);
      await interaction.reply({
        content: `❌ **Error**\n\n${error.message}`,
        ephemeral: true
      });
    }
  },
};

/**
 * Add support ticket button to open-a-ticket channel
 */
async function handleSupportButton(interaction) {
  const channel = interaction.guild.channels.cache.find(ch => ch.name === 'open-a-ticket');
  
  if (!channel) {
    return interaction.reply({
      content: '❌ **Error**\n\nCannot find the `open-a-ticket` channel.\n\nPlease run `/setup server` to create GCC structure first.',
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎫 Support Ticket System')
    .setDescription(
      '**Need help with Grizzly Bot?** Open a support ticket below.\n\n' +
      '**Support Categories:**\n' +
      '• Technical Support - Bot setup and configuration issues\n' +
      '• Nitrado Integration - Server authentication and monitoring\n' +
      '• Billing & Subscriptions - Patreon verification and payments\n\n' +
      '**Response Times:**\n' +
      '• Bronze/Silver: 24-48 hours\n' +
      '• Gold: 12 hours (priority support)\n' +
      '• Urgent Issues: Within 6 hours (all tiers)\n\n' +
      'Click the button below to create a **private ticket channel** visible only to you and our support staff.'
    )
    .setColor(0x00d4aa)
    .setFooter({ text: 'Your ticket will create a temporary private channel' })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('create_support_ticket')
    .setLabel('🎫 Open Support Ticket')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  await channel.send({
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({
    content: `✅ Support ticket button added to <#${channel.id}>`,
    ephemeral: true
  });

  logger.info(`Support ticket button added to ${channel.name} by ${interaction.user.tag}`);
}

/**
 * Add feedback ticket button to patreon-feedback channel
 */
async function handleFeedbackButton(interaction) {
  const channel = interaction.guild.channels.cache.find(ch => ch.name === 'patreon-feedback');
  
  if (!channel) {
    return interaction.reply({
      content: '❌ **Error**\n\nCannot find the `patreon-feedback` channel.\n\nPlease run `/setup server` to create GCC structure first.',
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('💡 Patreon Feedback & Suggestions')
    .setDescription(
      '**Help us improve Grizzly Bot!** Share your feedback and feature requests.\n\n' +
      '**What to Share:**\n' +
      '• Feature requests and ideas\n' +
      '• Bug reports and issues\n' +
      '• Improvement suggestions\n' +
      '• User experience feedback\n\n' +
      '**Your Impact:**\n' +
      '• Most voted features built first\n' +
      '• Gold subscribers get early beta access\n' +
      '• Top contributors recognized publicly\n\n' +
      'Click the button below to create a **private feedback ticket** where you can share detailed suggestions.'
    )
    .setColor(0xffd700)
    .setFooter({ text: 'Your feedback shapes the future of Grizzly Bot' })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('create_feedback_ticket')
    .setLabel('💡 Submit Feedback/Suggestion')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(button);

  await channel.send({
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({
    content: `✅ Feedback ticket button added to <#${channel.id}>`,
    ephemeral: true
  });

  logger.info(`Feedback ticket button added to ${channel.name} by ${interaction.user.tag}`);
}
