/**
 * interactions/buttons.js
 * Enhanced version with safety checks and detailed logging
 */

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../modules/db.js');
const logger = require('../config/logger.js');

// ──────────────────────────────────────────────
// Safe ephemeral reply helper (uses flags instead of deprecated "ephemeral")
// ──────────────────────────────────────────────
async function safeReply(interaction, options) {
  const payload = typeof options === 'string' ? { content: options } : options;
  payload.flags = 64; // 64 = EPHEMERAL
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp(payload);
    } else {
      return await interaction.reply(payload);
    }
  } catch (err) {
    logger.warn('safeReply failed:', err);
  }
}

// ──────────────────────────────────────────────
// Button interaction router
// ──────────────────────────────────────────────
async function handleButton(interaction) {
  const { customId } = interaction;

  try {
    if (customId === 'agree_to_rules' || customId === 'agree_rules') {
      return await handleRulesAgreement(interaction);
    }

    if (customId === 'verify_patreon_subscription') {
      return await handlePatreonVerification(interaction);
    }

    if (customId.startsWith('grizzly_bot_invite_')) {
      return await handleBotInvite(interaction, 'grizzly');
    }

    if (customId.startsWith('assistant_bot_invite_')) {
      return await handleBotInvite(interaction, 'assistant');
    }

    if (customId === 'create_support_ticket') {
      return await handleTicketCreation(interaction, 'support');
    }

    if (customId === 'create_feedback_ticket') {
      return await handleTicketCreation(interaction, 'feedback');
    }
  } catch (err) {
    logger.error('handleButton router error:', err);
    await safeReply(interaction, '❌ Something went wrong handling that button.');
  }
}

// ──────────────────────────────────────────────
// RULES AGREEMENT HANDLER (Fixed + Safe Permissions)
// ──────────────────────────────────────────────
async function handleRulesAgreement(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  const guildId = guild.id;
  const userId = member.id;

  try {
    const isGCC = guildId === process.env.GRIZZLY_COMMAND_GUILD_ID;

    if (isGCC) {
      // ─── Patreon Tier Roles ───
      const subResult = await db.query(
        'SELECT subscription_tier, active FROM patreon_subscriptions WHERE discord_id = $1 AND active = true',
        [userId]
      );

      const tierRoles = {
        Bronze: '1386839641041543178',
        Silver: '1386839640651145256',
        Gold: '1386839640123887627',
      };

      if (subResult.rows.length > 0) {
        const sub = subResult.rows[0];
        const roleId = tierRoles[sub.subscription_tier];
        if (roleId) {
          const role = guild.roles.cache.get(roleId);

          if (!role) {
            await safeReply(interaction, `⚠️ Role for ${sub.subscription_tier} tier not found.`);
            logger.warn(`Missing role for tier ${sub.subscription_tier} (${roleId})`);
            return;
          }

          // Check if bot can assign
          const botMember = guild.members.me;
          if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await safeReply(interaction, '⚠️ I lack the **Manage Roles** permission.');
            logger.error('Bot missing Manage Roles permission.');
            return;
          }

          const botHighest = botMember.roles.highest.position;
          const targetPos = role.position;
          if (targetPos >= botHighest) {
            await safeReply(interaction, `⚠️ I can’t assign **${role.name}** — it’s above my highest role.`);
            logger.error(`Role hierarchy issue: ${role.name} (${roleId}) is above bot’s top role.`);
            return;
          }

          await member.roles.add(role);
          await safeReply(interaction, `✅ Welcome! You’ve been assigned the **${sub.subscription_tier}** role.`);
          logger.info(`Assigned ${sub.subscription_tier} role to ${member.user.tag}`);
          return;
        }
      }

      // ─── Default Supporter Role ───
      const supporterRole = guild.roles.cache.get('1386839642035728456');
      if (supporterRole) {
        try {
          await member.roles.add(supporterRole);
          await safeReply(
            interaction,
            '✅ Welcome to Grizzly Command Central! You now have base access.\nUse the **Patreon Verification** button to unlock premium tiers.'
          );
          logger.info(`Assigned Supporter role to ${member.user.tag}`);
        } catch (permErr) {
          logger.error('Supporter role assignment failed:', permErr);
          await safeReply(
            interaction,
            '⚠️ I couldn’t assign your base role — please tell an admin to check my role hierarchy.'
          );
        }
      } else {
        await safeReply(interaction, '⚠️ Supporter role not found in this server.');
        logger.warn('Supporter role missing in GCC.');
      }

      return;
    }

    // ─── Subscriber Servers ───
    const playerRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'player');
    if (playerRole) {
      try {
        await member.roles.add(playerRole);
        await safeReply(interaction, '✅ Rules accepted! You now have access.');
        logger.info(`Player role added to ${member.user.tag} in ${guild.name}`);
      } catch (permErr) {
        logger.error(`Rules agreement error for ${member.user.tag}:`, permErr);
        await safeReply(
          interaction,
          '⚠️ I tried to assign your Player role, but I lack permission. Please alert an admin.'
        );
      }
    } else {
      await safeReply(interaction, '✅ Rules accepted! (No Player role configured.)');
    }
  } catch (error) {
    logger.error('Rules agreement error:', error);
    await safeReply(interaction, '❌ An unexpected error occurred while processing your agreement.');
  }
}

// ──────────────────────────────────────────────
// PATREON VERIFICATION HANDLER
// ──────────────────────────────────────────────
async function handlePatreonVerification(interaction) {
  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const existing = await db.query(
      'SELECT subscription_tier, active FROM patreon_subscriptions WHERE discord_id = $1',
      [userId]
    );

    if (existing.rows.length > 0 && existing.rows[0].active) {
      const tier = existing.rows[0].subscription_tier;
      await safeReply(interaction, `✅ You already have an active **${tier}** subscription verified!`);
      return;
    }

    const patreonOAuthUrl = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${process.env.PATREON_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.PATREON_REDIRECT_URI)}&scope=identity%20pledges-to-me&state=${userId}:${guildId}`;

    const embed = new EmbedBuilder()
      .setTitle('🔐 Patreon Verification')
      .setDescription('Click the link below to connect your Patreon account and verify your subscription!')
      .addFields([
        { name: '🔗 Verification Link', value: `[Click here to verify your Patreon](${patreonOAuthUrl})` },
        {
          name: '📋 Instructions',
          value:
            '1️⃣ Click the link\n2️⃣ Sign in to Patreon\n3️⃣ Authorize\n4️⃣ Your tier role will be assigned automatically',
        },
        { name: '💎 Available Tiers', value: '**Bronze** – $5/mo\n**Silver** – $10/mo\n**Gold** – $15/mo' },
      ])
      .setColor(0xff424d)
      .setFooter({ text: 'Secure OAuth2 verification — only verifies your tier status' })
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });
    logger.info(`User ${interaction.user.tag} requested Patreon verification`);
  } catch (error) {
    logger.error('Patreon verification button error:', error);
    await safeReply(interaction, '❌ Failed to generate verification link. Please try again later.');
  }
}

// ──────────────────────────────────────────────
// PLACEHOLDER INVITE HANDLER
// ──────────────────────────────────────────────
async function handleBotInvite(interaction, botType) {
  await safeReply(interaction, `Invite logic for ${botType} bot will go here.`);
  logger.info(`Handled ${botType} invite button from ${interaction.user.tag}`);
}

async function handleTicketCreation(interaction, ticketType) {
  const { PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
  const guild = interaction.guild;
  const user = interaction.user;
  const botMember = guild.members.me;

  try {
    // ──────────────────────────────────────────────
    // Permission sanity check before doing anything
    // ──────────────────────────────────────────────
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      await safeReply(interaction, '⚠️ I lack permission to **Manage Channels**. Please alert an admin.');
      logger.error('Missing ManageChannels permission.');
      return;
    }
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await safeReply(interaction, '⚠️ I lack permission to **Manage Roles**. Please alert an admin.');
      logger.error('Missing ManageRoles permission.');
      return;
    }

    // ──────────────────────────────────────────────
    // Check for existing open ticket
    // ──────────────────────────────────────────────
    const existingTicket = await db.query(
      'SELECT ticket_id, channel_id FROM tickets WHERE created_by = $1 AND guild_id = $2 AND status = $3',
      [user.id, guild.id, 'open']
    );

    if (existingTicket.rows.length > 0) {
      const chId = existingTicket.rows[0].channel_id;
      await safeReply(
        interaction,
        `❌ You already have an open ticket: <#${chId}>. Please close it before opening a new one.`
      );
      return;
    }

    // ──────────────────────────────────────────────
    // Defer reply since creating a channel may take time
    // ──────────────────────────────────────────────
    await interaction.deferReply({ flags: 64 });

    // ──────────────────────────────────────────────
    // Find or create "🎫 Active Tickets" category
    // ──────────────────────────────────────────────
    let category = guild.channels.cache.find(
      c => c.name === '🎫 Active Tickets' && c.type === ChannelType.GuildCategory
    );

    if (!category) {
      try {
        category = await guild.channels.create({
          name: '🎫 Active Tickets',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          ],
        });
        logger.info('Created missing 🎫 Active Tickets category.');
      } catch (err) {
        logger.error('Failed to create ticket category:', err);
        await interaction.editReply({ content: '❌ Could not create ticket category. Check my permissions.' });
        return;
      }
    }

    // ──────────────────────────────────────────────
    // Create DB entry
    // ──────────────────────────────────────────────
    const ticketCategory = ticketType === 'feedback' ? 'Feedback' : 'Technical Support';
    const ticketTitle =
      ticketType === 'feedback' ? 'Patreon Feedback/Suggestion' : 'Support Request';

    const result = await db.query(
      `INSERT INTO tickets (guild_id, created_by, title, status, category, priority, type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING ticket_id`,
      [guild.id, user.id, ticketTitle, 'open', ticketCategory, 'medium', ticketType]
    );
    const ticketId = result.rows[0].ticket_id;

    // ──────────────────────────────────────────────
    // Permission overwrites
    // ──────────────────────────────────────────────
    const supportStaff = guild.roles.cache.find(r => r.name === 'Support Staff');
    const developerRole = guild.roles.cache.find(r => r.name === 'Developer');

    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      },
    ];

    if (supportStaff)
      overwrites.push({
        id: supportStaff.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      });

    if (developerRole)
      overwrites.push({
        id: developerRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      });

    // ──────────────────────────────────────────────
    // Create ticket channel safely
    // ──────────────────────────────────────────────
    const chName = `ticket-${ticketId}-${user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create({
        name: chName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: overwrites,
      });
    } catch (err) {
      logger.error('Ticket channel creation failed:', err);
      await interaction.editReply({
        content: '❌ I could not create your ticket channel. Check my role hierarchy and permissions.',
      });
      return;
    }

    // ──────────────────────────────────────────────
    // Update DB
    // ──────────────────────────────────────────────
    await db.query('UPDATE tickets SET channel_id = $1 WHERE ticket_id = $2', [
      ticketChannel.id,
      ticketId,
    ]);

    // ──────────────────────────────────────────────
    // Welcome embed
    // ──────────────────────────────────────────────
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 Ticket #${ticketId}`)
      .setDescription(
        ticketType === 'feedback'
          ? `**Welcome ${user}**\n\nThank you for your feedback!\nPlease describe your suggestion and mark priority (Low/Medium/High).`
          : `**Welcome ${user}**\n\nPlease describe your issue, include screenshots if needed.\nA staff member will respond soon.`
      )
      .setColor(ticketType === 'feedback' ? 0xffd700 : 0x00d4aa)
      .addFields([
        { name: '📋 Category', value: ticketCategory, inline: true },
        { name: '📌 Status', value: 'Open', inline: true },
      ])
      .setFooter({ text: 'Use /ticket-close when your issue is resolved.' })
      .setTimestamp();

    await ticketChannel.send({
      content: `${user} ${supportStaff ? supportStaff : ''}`,
      embeds: [welcomeEmbed],
    });

    // Log creation
    const logChannel = guild.channels.cache.find(ch => ch.name === 'ticket-logs');
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🎫 New Ticket Created')
        .setDescription(
          `**Ticket:** #${ticketId}\n**Type:** ${ticketType}\n**User:** ${user.tag}\n**Channel:** <#${ticketChannel.id}>`
        )
        .setColor(0x00d4aa)
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }

    await interaction.editReply({
      content: `✅ Ticket #${ticketId} created successfully! Check <#${ticketChannel.id}>.`,
    });
    logger.info(`Ticket #${ticketId} created for ${user.tag} (${ticketType}).`);
  } catch (error) {
    logger.error('Ticket creation error:', error);
    await safeReply(interaction, `❌ Ticket creation failed: ${error.message}`);
  }
}

module.exports = { handleButton };
