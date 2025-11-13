
const { SlashCommandBuilder } = require('discord.js');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-bulk')
    .setDescription('Bulk ticket operations (Admin only)')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Bulk action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Close All Open', value: 'close_open' },
          { name: 'Close All Awaiting User', value: 'close_awaiting' },
          { name: 'Assign All Unassigned', value: 'assign_unassigned' }
        )
    )
    .addUserOption(option =>
      option.setName('assign_to')
        .setDescription('User to assign tickets to (for assign action)')
        .setRequired(false)
    ),
  execute: async interaction => {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if user has admin permissions
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.editReply({
          content: '❌ You need Administrator permissions for bulk operations.',
          ephemeral: true
        });
      }

      const action = interaction.options.getString('action');
      const assignTo = interaction.options.getUser('assign_to');
      let result;
      let message;

      switch (action) {
        case 'close_open':
          result = await db.query(
            'UPDATE tickets SET status = $1 WHERE status = $2 RETURNING ticket_id',
            ['closed', 'open']
          );
          message = `✅ Closed ${result.rows.length} open tickets`;
          break;

        case 'close_awaiting':
          result = await db.query(
            'UPDATE tickets SET status = $1 WHERE status = $2 RETURNING ticket_id',
            ['closed', 'awaiting_user']
          );
          message = `✅ Closed ${result.rows.length} tickets awaiting user response`;
          break;

        case 'assign_unassigned':
          if (!assignTo) {
            return interaction.editReply({
              content: '❌ You must specify a user to assign tickets to.',
              ephemeral: true
            });
          }
          result = await db.query(
            'UPDATE tickets SET assigned_to = $1 WHERE assigned_to IS NULL RETURNING ticket_id',
            [assignTo.id]
          );
          message = `✅ Assigned ${result.rows.length} unassigned tickets to ${assignTo.tag}`;
          break;
      }

      // Log bulk operation
      for (const ticket of result.rows) {
        await db.query(
          'INSERT INTO ticket_messages (ticket_id, user_id, message, message_type) VALUES ($1, $2, $3, $4)',
          [ticket.ticket_id, interaction.user.id, `Bulk operation: ${action}`, 'system']
        );
      }

      await interaction.editReply({
        content: message,
        ephemeral: true
      });

    } catch (error) {
      console.error('Bulk operation error:', error);
      await interaction.editReply({
        content: '❌ Error performing bulk operation.',
        ephemeral: true
      });
    }
  }
};
