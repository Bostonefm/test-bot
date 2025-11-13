const { SlashCommandBuilder } = require('discord.js');
const { getPool } = require('../utils/db.js');
const logger = require('../config/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply for a role')
    .addStringOption(o =>
      o.setName('role').setDescription('Role you want to apply for').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Why you want this role').setRequired(true)
    ),

  async execute(interaction) {
    const pool = getPool();
    try {
      const role = interaction.options.getString('role');
      const reason = interaction.options.getString('reason');

      const { rows } = await pool.query(
        `INSERT INTO tickets (type, category, title, created_by, data, status)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING ticket_id`,
        [
          'application',
          'role',
          `Role Application: ${role}`,
          interaction.user.id,
          JSON.stringify({ role, reason }),
          'pending',
        ]
      );

      const ticketId = rows[0].ticket_id;

      // optional: send to mod-log if present
      const logChannel =
        interaction.guild.channels.cache.find(ch => ch.name === 'mod-log') || null;

      if (logChannel) {
        await logChannel.send({
          content:
            `📝 **New Role Application #${ticketId}**\n` +
            `**User:** <@${interaction.user.id}>\n` +
            `**Role:** ${role}\n` +
            `**Reason:** ${reason}\n` +
            `Use \`/approve ${ticketId}\` or \`/deny ${ticketId}\`.`,
        });
      }

      await interaction.reply({
        content: `✅ Application submitted! Ticket #${ticketId} created.`,
        ephemeral: true,
      });
    } catch (err) {
      logger.error('Error creating application:', err);
      await interaction.reply({ content: '❌ Error submitting application.', ephemeral: true });
    }
  },
};
