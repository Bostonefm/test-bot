const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const logger = require('../modules/logger');
const centralConfig = require('../config/central.config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gcc-repopulate')
    .setDescription('Clear and repopulate GCC channels with factual information')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Check if interaction is still valid before deferring
    if (interaction.replied || interaction.deferred) {
      return;
    }

    try {
      await interaction.deferReply();
    } catch (error) {
      // If deferReply fails, the interaction might have expired
      logger.error('Failed to defer reply:', error);
      return;
    }

    const guild = interaction.guild;

    // Only allow in GCC server
    if (guild.id !== process.env.GRIZZLY_COMMAND_GUILD_ID) {
      return await interaction.editReply(
        '❌ This command can only be used in Grizzly Command Central.'
      );
    }

    logger.info(`Repopulating GCC channels for guild: ${guild.name}`);

    const results = {
      channelsCleared: 0,
      channelsRepopulated: 0,
      permissionsUpdated: 0,
      errors: [],
    };

    // Information channels that should be read-only
    const infoChannels = [
      'welcome',
      'rules',
      'about-the-bots',
      'how-to-subscribe',
      'silver-tier-servers',
      'featured-servers',
      'partner-servers',
    ];

    try {
      // Repopulate channels from the config
      const skipChannels = ['rules', 'welcome'];

      // Process each channel with factual content
      for (const channelName of Object.keys(centralConfig.starterMessages)) {
        const channel = guild.channels.cache.find(c => c.name === channelName);
        if (!channel) {
          continue;
        }

        // Skip channels that have custom content we want to preserve
        if (skipChannels.includes(channelName)) {
          logger.info(`Skipping ${channelName} channel - preserving custom content`);
          continue;
        }

        try {
          // Clear existing messages
          const messages = await channel.messages.fetch({ limit: 100 });
          if (messages.size > 0) {
            await channel.bulkDelete(messages);
            results.channelsCleared++;
            logger.info(`✅ Cleared ${channelName} channel`);
          }

          // Send new factual content
          const content = centralConfig.starterMessages[channelName];
          await channel.send(content);
          results.channelsRepopulated++;
          logger.info(`✅ Repopulated ${channelName} with factual content`);

          // Update permissions for info channels to be read-only
          if (infoChannels.includes(channelName)) {
            const adminRole = guild.roles.cache.find(r => r.name === 'Admin');
            const moderatorRole = guild.roles.cache.find(r => r.name === 'Moderator');

            const permissionOverwrites = [
              {
                id: guild.roles.everyone.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.ReadMessageHistory,
                ],
                deny: [
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.AddReactions,
                ],
              },
            ];

            if (adminRole) {
              permissionOverwrites.push({
                id: adminRole.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.ReadMessageHistory,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ManageMessages,
                  PermissionsBitField.Flags.EmbedLinks,
                  PermissionsBitField.Flags.AttachFiles,
                ],
              });
            }

            if (moderatorRole && (channelName === 'welcome' || channelName === 'rules')) {
              permissionOverwrites.push({
                id: moderatorRole.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.ReadMessageHistory,
                  PermissionsBitField.Flags.SendMessages,
                ],
              });
            }

            await channel.permissionOverwrites.set(permissionOverwrites);
            results.permissionsUpdated++;
            logger.info(`✅ Updated permissions for ${channelName} to read-only`);
          }
        } catch (error) {
          logger.error(`Failed to process channel ${channelName}:`, error);
          results.errors.push(`${channelName}: ${error.message}`);
        }
      }

      // Special handling for verify-patreon channel with professional embedded design
      const verifyChannel = guild.channels.cache.find(c => c.name === 'verify-patreon');
      if (verifyChannel) {
        try {
          // Clear existing messages
          const messages = await verifyChannel.messages.fetch({ limit: 100 });
          if (messages.size > 0) {
            await verifyChannel.bulkDelete(messages);
          }

          // Create professional verification button
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('verify_patreon_subscription')
              .setLabel('🔐 Verify Patreon Subscription')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⭐')
          );

          // Main verification embed with professional styling
          const verificationEmbed = new EmbedBuilder()
            .setTitle('🔐 Patreon Subscription Verification')
            .setDescription('**Professional GCC Subscription Authentication**\n\nSecurely link your Patreon subscription to unlock premium features and access tier-appropriate channels.')
            .addFields([
              {
                name: '✨ Verification Benefits',
                value: '• Automatic tier role assignment\n• Instant access to premium channels\n• Professional support and assistance\n• Server monitoring and management tools',
                inline: false,
              },
              {
                name: '🔒 Secure OAuth2 Process',
                value: '• Click verification button below\n• Authenticate through Patreon OAuth2\n• Automatic subscription tier detection\n• Immediate role and permission updates',
                inline: false,
              },
              {
                name: '🎫 After Verification',
                value: '• Premium channels unlock automatically\n• Bot invite channels become accessible\n• Open tickets for professional support\n• Access tier-appropriate features',
                inline: false,
              }
            ])
            .setColor(0xFFD700)
            .setThumbnail('https://cdn.discordapp.com/attachments/1056963130833506344/1391514726892429322/grizzly.png')
            .setTimestamp();

          await verifyChannel.send({
            embeds: [verificationEmbed],
            components: [row],
          });

          // Add subscription tiers information embed for consistency
          const tiersEmbed = new EmbedBuilder()
            .setTitle('💎 GCC Subscription Tiers & Pricing')
            .setDescription('Professional DayZ server management solutions for every need')
            .addFields(
              {
                name: '🥉 Bronze - $6/month',
                value: '• Grizzly Bot access and core features\n• Kill feeds and basic player tracking\n• Standard server monitoring capabilities\n• Community support access',
                inline: true,
              },
              {
                name: '🥈 Silver - $10/month',
                value: '• All Bronze features included\n• Website server listing showcase\n• Advanced monitoring and analytics\n• Enhanced player tracking tools',
                inline: true,
              },
              {
                name: '🥇 Gold - $15/month',
                value: '• All Silver features included\n• Featured server listing priority\n• Priority support and assistance\n• Advanced configuration options',
                inline: true,
              },
              {
                name: '💎 Partner - $20/month',
                value: '• Exclusive partnership benefits and recognition\n• Enterprise-level solutions and support\n• Direct developer access and consultation\n• Custom integrations and features',
                inline: false,
              }
            )
            .setColor(0xffd700)
            .setFooter({
              text: 'Choose your perfect plan for professional DayZ server management',
              iconURL: 'https://cdn.discordapp.com/attachments/1056963130833506344/1391514726892429322/grizzly.png'
            });

          await verifyChannel.send({ embeds: [tiersEmbed] });

          // Add security and support information embed
          const securityEmbed = new EmbedBuilder()
            .setTitle('🛡️ Security & Professional Support')
            .setDescription('Your verification process is secure and professional support is always available')
            .addFields([
              {
                name: '🔐 Security Features',
                value: '• Industry-standard OAuth2 authentication\n• No password storage - secure token exchange\n• Encrypted data transmission\n• Privacy-focused subscription verification',
                inline: false,
              },
              {
                name: '🎫 Professional Support',
                value: '• **Enterprise Setup:** Open a ticket for business solutions\n• **Technical Issues:** Open a ticket for immediate assistance\n• **Billing Support:** Patreon and subscription management help\n• **Community Help:** Support channels and documentation',
                inline: false,
              }
            ])
            .setColor(0x00FF88)
            .setThumbnail('https://cdn.discordapp.com/attachments/1056963130833506344/1391514726892429322/grizzly.png')
            .setTimestamp();

          await verifyChannel.send({ embeds: [securityEmbed] });

          logger.info(`✅ Added professional verification system to verify-patreon channel`);
          results.channelsPopulated++;
        } catch (error) {
          logger.error('Failed to set up verify-patreon professional design:', error);
          results.errors.push(`verify-patreon professional design: ${error.message}`);
        }
      }

      // About the bots channel
      const aboutBotsChannel = guild.channels.cache.find(c => c.name === 'about-the-bots');
      if (aboutBotsChannel) {
        try {
          const messages = await aboutBotsChannel.messages.fetch({ limit: 100 });
          if (messages.size > 0) {
            await aboutBotsChannel.bulkDelete(messages);
          }

          const aboutBotsEmbed = new EmbedBuilder()
            .setTitle('🤖 GCC: Grizzly Bot - Premium DayZ Server Management')
            .setDescription('Professional server monitoring and analytics for serious DayZ operators')
            .addFields([
              {
                name: '⚡ Grizzly Bot - Premium DayZ Server Management',
                value:
                  '• Advanced server monitoring and analytics\n' +
                  '• Real-time player tracking and kill feeds\n' +
                  '• Automated server administration tools\n' +
                  '• Nitrado server integration and control\n' +
                  '• Requires active GCC subscription for full access',
                inline: false,
              },
              {
                name: '🔗 Professional Integration',
                value:
                  '• Subscribe to GCC for Grizzly Bot access\n' +
                  '• Use `/nitrado-auth` to connect your servers\n' +
                  '• Enterprise-grade solutions for serious server operators\n' +
                  '• Open tickets for professional support assistance',
                inline: false,
              },
              {
                name: '🚀 Getting Started',
                value:
                  '• Subscribe to GCC for Grizzly Bot access\n' +
                  '• Verify your subscription in <#verify-patreon>\n' +
                  '• Invite bot from <#grizzly-bot-invite>\n' +
                  '• Use `/nitrado-auth` to connect your servers',
                inline: false,
              },
            ])
            .setColor(0xFFD700)
            .setThumbnail('https://cdn.discordapp.com/attachments/1056963130833506344/1391514726892429322/grizzly.png')
            .setFooter({
              text: 'Professional DayZ Server Management • Powered by Grizzly Gaming',
              iconURL: 'https://cdn.discordapp.com/attachments/1056963130833506344/1391514726892429322/grizzly.png',
            })
            .setTimestamp();

          await aboutBotsChannel.send({ embeds: [aboutBotsEmbed] });
          results.channelsUpdated++;
        } catch (error) {
          results.errors.push(`About bots: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error('Error during GCC repopulation:', error);
      results.errors.push(`General error: ${error.message}`);
    }

    // Send completion report
    const successMessage =
      `✅ **GCC Channels Repopulated!**\n\n` +
      `🧹 **Channels Cleared:** ${results.channelsCleared}\n` +
      `📝 **Channels Repopulated:** ${results.channelsRepopulated}\n` +
      `🔒 **Info Channels Made Read-Only:** ${results.permissionsUpdated}\n` +
      `⚠️ **Errors:** ${results.errors.length}\n\n` +
      `**Factual Information Updated:**\n` +
      `• Patreon tiers and pricing\n` +
      `• Support contact: Open a ticket\n` +
      `• Technical specifications\n` +
      `• Community guidelines\n` +
      `• Platform support details\n\n` +
      `**Info channels are now read-only for members.**`;

    // Safe reply handling
    try {
      if (results.errors.length > 0) {
        const errorList = results.errors.slice(0, 3).join('\n');
        await interaction.editReply({
          content: successMessage + `\n\n❌ **Errors:**\n\`\`\`${errorList}\`\`\``,
        });
      } else {
        await interaction.editReply({ content: successMessage });
      }
    } catch (replyError) {
      logger.error('Failed to send final reply:', replyError);
      // If editReply fails, try a follow-up
      try {
        await interaction.followUp({
          content: '✅ GCC repopulation completed but failed to send detailed results.',
          ephemeral: true
        });
      } catch (followUpError) {
        logger.error('Failed to send follow-up message:', followUpError);
      }
    }

    logger.info(`GCC repopulation completed: ${results.channelsRepopulated} channels processed`);
  },
}
