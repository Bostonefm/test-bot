const {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const logger = require('../modules/logger');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome-message')
    .setDescription('Manage automatic welcome messages for new members (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configure automatic welcome messages in a channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel for welcome messages (defaults to #welcome-message)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set or update custom welcome message')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Welcome message. Use {user}, {rules}, {server} placeholders')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('preview').setDescription('Preview current welcome message')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('reset').setDescription('Reset welcome message to default template')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('edit').setDescription('Edit the welcome message template')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('test').setDescription('Send a test welcome message')
    ),

  async execute(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to manage welcome messages.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'set') {
        // Set custom welcome message
        const message = interaction.options.getString('message');
        const { setCustomWelcomeMessage } = require('../modules/welcomeHandler.js');
        
        await setCustomWelcomeMessage(interaction.guild.id, message);
        
        await interaction.reply({
          content: `✅ Custom welcome message updated!\n\n**Preview:**\n${message
            .replace('{user}', interaction.user.toString())
            .replace('{server}', interaction.guild.name)
            .replace('{rules}', '#rules')}`,
          flags: MessageFlags.Ephemeral,
        });
        
        logger.info(`Updated welcome message for ${interaction.guild.name}`);
      } else if (subcommand === 'preview') {
        // Preview current welcome message
        const result = await db.query(
          'SELECT welcome_message FROM guild_settings WHERE guild_id = $1',
          [interaction.guild.id]
        );
        
        if (result.rows.length === 0 || !result.rows[0].welcome_message) {
          return interaction.reply({
            content: '⚠️ No custom welcome message found. Use `/welcome-message set` to create one.',
            flags: MessageFlags.Ephemeral,
          });
        }
        
        const message = result.rows[0].welcome_message;
        const preview = message
          .replace('{user}', interaction.user.toString())
          .replace('{server}', interaction.guild.name)
          .replace('{rules}', `<#${interaction.guild.channels.cache.find(c => c.name === 'rules')?.id || 'rules'}>`);
        
        await interaction.reply({
          content: `🪶 **Current Welcome Message Preview:**\n\n${preview}`,
          flags: MessageFlags.Ephemeral,
        });
        
        logger.info(`Previewed welcome message for ${interaction.guild.name}`);
      } else if (subcommand === 'reset') {
        // Reset welcome message to default
        await db.query(
          'UPDATE guild_settings SET welcome_message = NULL WHERE guild_id = $1',
          [interaction.guild.id]
        );
        
        await interaction.reply({
          content: '🔄 Welcome message has been reset to the default template.\nUse `/welcome-message set` anytime to customize it again.',
          flags: MessageFlags.Ephemeral,
        });
        
        logger.info(`Reset welcome message for ${interaction.guild.name}`);
      } else if (subcommand === 'edit') {
        // Show modal for editing welcome message
        const modal = new ModalBuilder()
          .setCustomId('edit_welcome_message')
          .setTitle('Edit Welcome Message');

        // Get current welcome message
        let currentMessage = '';
        try {
          const result = await db.query(
            'SELECT welcome_message FROM guild_settings WHERE guild_id = $1',
            [interaction.guild.id]
          );
          if (result.rows.length > 0 && result.rows[0].welcome_message) {
            currentMessage = result.rows[0].welcome_message;
          }
        } catch (error) {
          logger.warn('Could not fetch current welcome message:', error.message);
        }

        const titleInput = new TextInputBuilder()
          .setCustomId('welcome_title')
          .setLabel('Welcome Message Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setValue('Welcome Message');

        const messageInput = new TextInputBuilder()
          .setCustomId('welcome_content')
          .setLabel('Welcome Message Content (Use {user} for mention, {rules} for rules channel)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1800)
          .setValue(currentMessage || getDefaultWelcomeMessage());

        const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
        const secondActionRow = new ActionRowBuilder().addComponents(messageInput);

        modal.addComponents(firstActionRow, secondActionRow);

        return await interaction.showModal(modal);
      } else if (subcommand === 'setup') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channel =
          interaction.options.getChannel('channel') ||
          interaction.guild.channels.cache.find(c => c.name === 'welcome-message');

        if (!channel) {
          return interaction.editReply({
            content:
              '❌ Channel not found. Please specify a channel or ensure a #welcome-message channel exists.',
          });
        }

        // Get custom welcome message or use default
        let welcomeTitle = '🎮 Welcome to the DayZ Server!';
        let welcomeContent = getDefaultWelcomeMessage();

        try {
          const result = await db.query(
            'SELECT welcome_title, welcome_message FROM guild_settings WHERE guild_id = $1',
            [interaction.guild.id]
          );
          if (result.rows.length > 0) {
            if (result.rows[0].welcome_title) {
              welcomeTitle = result.rows[0].welcome_title;
            }
            if (result.rows[0].welcome_message) {
              welcomeContent = result.rows[0].welcome_message;
            }
          }
        } catch (error) {
          logger.warn('Could not fetch custom welcome message, using default:', error.message);
        }

        await channel.send({
          content: `📢 **Welcome Message Setup**\n\nThis channel is now configured for automatic welcome messages. New members will receive a welcome message here when they join the server.\n\n**Current Message Preview:**\n${welcomeContent.replace('{user}', '@NewMember').replace('{rules}', '#rules')}`
        });

        await interaction.editReply({
          content: `✅ Welcome message system setup in ${channel}!\n\n**Features:**\n• Automatic messages when members join\n• Customizable with \`/welcome-message edit\`\n• Use \`{user}\` for member mentions\n• Use \`{rules}\` for rules channel reference`,
        });

        logger.info(`Admin ${interaction.user.tag} set up welcome message in ${channel.name}`);
      } else if (subcommand === 'test') {
        const testEmbed = {
          color: 0x0099ff,
          title: '🧪 Welcome Message Test',
          description: 'This is a test of the welcome message system.',
          footer: { text: 'Test message - will be deleted shortly' },
        };

        const message = await interaction.followUp({ embeds: [testEmbed] });

        setTimeout(async () => {
          try {
            await message.delete();
          } catch (error) {
            logger.warn('Could not delete test message:', error.message);
          }
        }, 10000);

        await interaction.editReply({
          content: '✅ Test message sent! It will be deleted in 10 seconds.',
        });
      }
    } catch (error) {
      logger.error('Welcome message error:', error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ Failed to manage welcome message.',
        });
      } else {
        await interaction.reply({
          content: '❌ Failed to manage welcome message.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },

  // Handle modal submission
  async handleModal(interaction) {
    if (interaction.customId !== 'edit_welcome_message') {
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const title = interaction.fields.getTextInputValue('welcome_title');
      const content = interaction.fields.getTextInputValue('welcome_content');

      // Save to database
      await db.query(
        `
        INSERT INTO guild_settings (guild_id, welcome_title, welcome_message) 
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id) 
        DO UPDATE SET welcome_title = $2, welcome_message = $3
      `,
        [interaction.guild.id, title, content]
      );

      await interaction.editReply({
        content:
          '✅ Welcome message updated successfully! Use `/welcome-message setup` to post it in a channel.',
      });

      logger.info(
        `Admin ${interaction.user.tag} updated welcome message for guild ${interaction.guild.id}`
      );
    } catch (error) {
      logger.error('Welcome message modal error:', error);
      await interaction.editReply({
        content: '❌ Failed to save welcome message.',
      });
    }
  },
};

function getDefaultWelcomeMessage() {
  return `Welcome to the server! For access to the full server experience, head over to <#rules> and Agree to Gain full Access.`;
}
