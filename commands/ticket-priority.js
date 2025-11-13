
const { SlashCommandBuilder } = require('discord.js');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-priority')
    .setDescription('Change ticket priority (Admin only)')
    .addStringOption(option =>
      option.setName('ticket_id')
        .setDescription('Ticket ID to update')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('priority')
        .setDescription('New priority level')
        .setRequired(true)
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
          { name: 'Critical', value: 'critical' }
        )
    ),
  execute: async interaction => {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if user has admin permissions
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.editReply({
          content: '❌ You need Administrator permissions to change ticket priorities.',
          ephemeral: true
        });
      }

      const ticketId = interaction.options.getString('ticket_id');
      const newPriority = interaction.options.getString('priority');

      // Update ticket priority
      const result = await db.query(
        'UPDATE tickets SET priority = $1 WHERE ticket_id = $2 RETURNING *',
        [newPriority, ticketId]
      );

      if (result.rows.length === 0) {
        return interaction.editReply({
          content: '❌ Ticket not found.',
          ephemeral: true
        });
      }

      // Log the priority change
      await db.query(
        'INSERT INTO ticket_messages (ticket_id, user_id, message, message_type) VALUES ($1, $2, $3, $4)',
        [ticketId, interaction.user.id, `Priority changed to: ${newPriority}`, 'system']
      );

      await interaction.editReply({
        content: `✅ Ticket #${ticketId} priority changed to **${newPriority.toUpperCase()}**`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Priority change error:', error);
      await interaction.editReply({
        content: '❌ Error changing ticket priority.',
        ephemeral: true
      });
    }
  }
};
