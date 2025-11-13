const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deny')
    .setDescription('Deny a role application')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addIntegerOption(option =>
      option.setName('ticket_id')
        .setDescription('Ticket ID to deny')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for denial')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) && 
        !interaction.member.roles.cache.some(role => ['Admin', 'Moderator', 'Staff'].includes(role.name))) {
      return interaction.reply({ content: '❌ You need Admin/Moderator permissions to deny applications.', ephemeral: true });
    }

    try {
      const ticketId = interaction.options.getInteger('ticket_id');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const result = await db.query(
        'SELECT * FROM tickets WHERE ticket_id = $1 AND type = $2',
        [ticketId, 'application']
      );

      if (result.rows.length === 0) {
        return interaction.reply({ content: '❌ Application not found.', ephemeral: true });
      }

      const ticket = result.rows[0];

      await db.query(
        'UPDATE tickets SET status = $1, assigned_to = $2, resolved_at = NOW() WHERE ticket_id = $3',
        ['denied', interaction.user.id, ticketId]
      );

      const member = await interaction.guild.members.fetch(ticket.created_by);
      if (member) {
        await member.send(`❌ Your application for **${ticket.data.role}** has been denied.\n**Reason:** ${reason}`).catch(() => {});
      }

      await interaction.reply({ 
        content: `❌ Application #${ticketId} denied.`, 
        ephemeral: true 
      });
    } catch (error) {
      const logger = require('../modules/logger');
      logger.error('Error denying application:', error);
      await interaction.reply({ content: 'Error denying application.', ephemeral: true });
    }
  }
};
