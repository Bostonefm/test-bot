const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../modules/db');
const PermissionManager = require('../modules/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-button')
    .setDescription('Create interactive ticket button (Admin only)'),

  execute: async interaction => {
    // Check if user is admin
    if (!PermissionManager.isAdmin(interaction.member)) {
      return interaction.reply({ 
        content: PermissionManager.createErrorMessage('ADMIN'), 
        ephemeral: true 
      });
    }

    // Auto-register server if needed
    const guildId = interaction.guild.id;
    const serverCheck = await db.query(
      'SELECT * FROM registered_servers WHERE guild_id = $1',
      [guildId]
    );

    if (serverCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO registered_servers 
         (guild_id, owner_id, server_name, description, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [guildId, interaction.user.id, interaction.guild.name, 'Auto-registered for ticket system', 'active']
      );
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 Support Tickets')
      .setDescription('Need help? Click the button below to open a support ticket.\n\nOur staff will assist you as soon as possible!')
      .setColor(0x00D4AA)
      .setFooter({ text: 'Grizzly Support System' });

    const button = new ButtonBuilder()
      .setCustomId('open_ticket')
      .setLabel('🎫 Open Ticket')
      .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      embeds: [embed],
      components: [actionRow]
    });
  },

  async handleButton(interaction) {
    if (interaction.customId === 'open_ticket') {
      // Check if user already has an open ticket
      const existingTicket = await db.query(
        'SELECT ticket_id FROM tickets WHERE created_by = $1 AND guild_id = $2 AND status = $3',
        [interaction.user.id, interaction.guild.id, 'open']
      );

      if (existingTicket.rows.length > 0) {
        return interaction.reply({
          content: `❌ You already have an open ticket: #${existingTicket.rows[0].ticket_id}`,
          ephemeral: true
        });
      }

      // Create new ticket
      const ticketResult = await db.query(
        `INSERT INTO tickets (guild_id, created_by, title, status, category, priority, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING ticket_id`,
        [interaction.guild.id, interaction.user.id, 'Support Request', 'open', 'general', 'medium']
      );

      const ticketId = ticketResult.rows[0].ticket_id;

      // Add initial message
      await db.query(
        `INSERT INTO ticket_messages (ticket_id, user_id, username, message, is_staff)
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, interaction.user.id, interaction.user.username, 'Support ticket created via button', false]
      );

      await interaction.reply({
        content: `✅ Ticket #${ticketId} has been created! You can view it at https://tickets.grizzlygaming-gg.com`,
        ephemeral: true
      });

      // Notify staff in log channel if configured
      const logChannel = interaction.guild.channels.cache.find(ch => ch.name === 'ticket-log');
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🎫 New Ticket Created')
          .setDescription(`**Ticket:** #${ticketId}\n**User:** ${interaction.user.tag}\n**Created via:** Button`)
          .setColor(0x00D4AA)
          .setTimestamp();

        logChannel.send({ embeds: [logEmbed] });
      }
    }
  }
};
