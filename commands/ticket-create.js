const { SlashCommandBuilder } = require('discord.js');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-create')
    .setDescription('Open a support ticket')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Brief description of your issue')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('priority')
        .setDescription('Priority level')
        .setRequired(false)
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' }
        ))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Issue category')
        .setRequired(false)
        .addChoices(
          { name: 'General Support', value: 'general' },
          { name: 'Technical Issue', value: 'technical' },
          { name: 'Account Issue', value: 'account' },
          { name: 'Bot Issue', value: 'bot' },
          { name: 'Other', value: 'other' }
        )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const serverCheck = await db.query(
        'SELECT * FROM registered_servers WHERE guild_id = $1 AND status = $2',
        [interaction.guild.id, 'active']
      );

      if (serverCheck.rows.length === 0) {
        return interaction.editReply({
          content: '❌ This server must be registered to use the ticket system. Ask an admin to run `/register-server` first.',
          ephemeral: true
        });
      }

      const title = interaction.options.getString('title') || 'Support Request';
      const priority = interaction.options.getString('priority') || 'medium';
      const category = interaction.options.getString('category') || 'general';

      const insertQuery = `
        INSERT INTO tickets (title, priority, category, created_by, status)
        VALUES ($1, $2, $3, $4, 'open')
        RETURNING ticket_id
      `;
      
      const result = await db.query(insertQuery, [title, priority, category, interaction.user.id]);
      const ticketId = result.rows[0].ticket_id;

      const thread = await interaction.channel.threads.create({
        name: `ticket-${ticketId}-${interaction.user.username}`,
        autoArchiveDuration: 60,
        reason: 'Support ticket'
      });

      await db.query(`
        UPDATE tickets 
        SET channel_id = $1, data = jsonb_set(data, '{thread_name}', $2)
        WHERE ticket_id = $3
      `, [thread.id, JSON.stringify(thread.name), ticketId]);

      await thread.send({
        embeds: [{
          title: `🎫 Ticket #${ticketId}`,
          description: `**${title}**\n\nHello <@${interaction.user.id}>, thank you for creating a support ticket!\n\n**Priority:** ${priority.toUpperCase()}\n**Category:** ${category}\n\nOur staff will assist you shortly.`,
          color: 0x00D4AA,
          footer: { text: 'Grizzly Support System' },
          timestamp: new Date().toISOString()
        }]
      });

      await db.query(`
        INSERT INTO ticket_messages (ticket_id, user_id, username, message, is_staff)
        VALUES ($1, $2, $3, $4, false)
      `, [
        ticketId, 
        interaction.user.id, 
        interaction.user.username,
        `Created ticket: ${title}`
      ]);

      await interaction.editReply({ 
        content: `✅ Ticket #${ticketId} created! Check the thread: <#${thread.id}>`, 
        ephemeral: true 
      });

    } catch (error) {
      console.error('Ticket creation error:', error);
      await interaction.editReply({ 
        content: 'Error creating ticket. Please try again.', 
        ephemeral: true 
      });
    }
  }
};
