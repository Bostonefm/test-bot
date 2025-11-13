const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Close this support ticket'),

  async execute(interaction) {
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || 
                   interaction.member.roles.cache.some(role => ['Admin', 'Moderator', 'Staff', 'Support'].includes(role.name));

    try {
      const channel = interaction.channel;
      
      if (!channel.isThread()) {
        return interaction.reply({ content:'❌ Run this in a ticket thread.', ephemeral:true });
      }

      const result = await db.query(
        'SELECT * FROM tickets WHERE channel_id = $1 AND status = $2',
        [channel.id, 'open']
      );

      if (result.rows.length === 0) {
        return interaction.reply({ content: '❌ No open ticket found for this channel.', ephemeral: true });
      }

      const ticket = result.rows[0];

      if (!isStaff && ticket.created_by !== interaction.user.id) {
        return interaction.reply({ content: '❌ You can only close your own tickets.', ephemeral: true });
      }

      await db.query(
        'UPDATE tickets SET status = $1, resolved_at = NOW(), assigned_to = $2 WHERE ticket_id = $3',
        ['closed', interaction.user.id, ticket.ticket_id]
      );

      await channel.setArchived(true);
      await interaction.reply({ content:'✅ Ticket closed!', ephemeral:true });

    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.reply({ content: 'Error closing ticket.', ephemeral: true });
    }
  }
};
