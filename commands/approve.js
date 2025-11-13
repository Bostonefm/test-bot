const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getPool } = require('../utils/db.js');
const logger = require('../config/logger.js');
const { requireModLike } = require('../modules/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('approve')
    .setDescription('Approve a role application')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addIntegerOption(o =>
      o.setName('ticket_id').setDescription('Ticket ID to approve').setRequired(true)
    ),

  async execute(interaction) {
    const pool = getPool();
    try {
      // permission gate (role names OR ManageGuild fallback)
      requireModLike(interaction);

      const ticketId = interaction.options.getInteger('ticket_id');

      const { rows } = await pool.query(
        `SELECT ticket_id, created_by, data
         FROM tickets
         WHERE ticket_id = $1 AND type = 'application'`,
        [ticketId]
      );
      if (!rows.length) {
        return interaction.reply({ content: '❌ Application not found.', ephemeral: true });
      }

      const ticket = rows[0];
      const data =
        typeof ticket.data === 'string' ? JSON.parse(ticket.data || '{}') : ticket.data || {};
      const roleName = (data.role || '').toString();

      await pool.query(
        `UPDATE tickets
         SET status = 'approved', assigned_to = $1, resolved_at = NOW()
         WHERE ticket_id = $2`,
        [interaction.user.id, ticketId]
      );

      // assign role if it exists
      const member = await interaction.guild.members.fetch(ticket.created_by).catch(() => null);
      const role =
        roleName &&
        interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

      if (member && role) {
        await member.roles.add(role).catch(() => {});
        await member
          .send(`🎉 Your application for **${role.name}** has been approved!`)
          .catch(() => {});
      }

      await interaction.reply({
        content: `✅ Application #${ticketId} approved${role ? ' and role assigned' : ''}!`,
        ephemeral: true,
      });
    } catch (err) {
      logger.error('Error approving application:', err);
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
