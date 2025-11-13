const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-list')
    .setDescription('List all active tickets (Staff only)')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Filter by status')
        .setRequired(false)
        .addChoices(
          { name: 'Open', value: 'open' },
          { name: 'Closed', value: 'closed' }
        ))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Filter by user')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && 
        !interaction.member.roles.cache.some(role => ['Admin', 'Moderator', 'Staff', 'Support'].includes(role.name))) {
      return interaction.reply({ content: '❌ You need Staff permissions to list tickets.', ephemeral: true });
    }

    try {
      const status = interaction.options.getString('status') || 'open';
      const user = interaction.options.getUser('user');

      let query = 'SELECT * FROM tickets WHERE status = $1';
      let params = [status];

      if (user) {
        query += ' AND created_by = $2';
        params.push(user.id);
      }

      query += ' ORDER BY created_at DESC LIMIT 20';

      const result = await db.query(query, params);

      if (result.rows.length === 0) {
        return interaction.reply({ content: `No ${status} tickets found.`, ephemeral: true });
      }

      const ticketList = result.rows.map(ticket => {
        const createdBy = `<@${ticket.created_by}>`;
        const created = new Date(ticket.created_at).toLocaleDateString();
        return `**#${ticket.ticket_id}** - ${ticket.title || 'No title'} | ${createdBy} | ${created}`;
      }).join('\n');

      await interaction.reply({ 
        content: `📋 **${status.toUpperCase()} Tickets:**\n${ticketList}`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Error listing tickets:', error);
      await interaction.reply({ content: 'Error retrieving tickets.', ephemeral: true });
    }
  }
};
