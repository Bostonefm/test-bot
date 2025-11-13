const { SlashCommandBuilder } = require('discord.js');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('When to remind (e.g., 10m, 1h, 2d)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('What to remind you about')
        .setRequired(true)),

  async execute(interaction) {
    try {
      const timeStr = interaction.options.getString('time');
      const message = interaction.options.getString('message');
      
      const timeMatch = timeStr.match(/^(\d+)([mhd])$/);
      if (!timeMatch) {
        return interaction.reply({ content: '❌ Invalid time format. Use: 10m, 1h, 2d', ephemeral: true });
      }
      
      const [, amount, unit] = timeMatch;
      const multiplier = { m: 60000, h: 3600000, d: 86400000 };
      const remindAt = new Date(Date.now() + parseInt(amount) * multiplier[unit]);
      
      await db.query(
        'INSERT INTO tickets (type, category, title, created_by, data, status, resolved_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['reminder', 'personal', message, interaction.user.id, 
         JSON.stringify({ channel_id: interaction.channelId }), 'scheduled', remindAt]
      );
      
      await interaction.reply({ 
        content: `⏰ Reminder set for ${remindAt.toLocaleString()}!`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Error setting reminder:', error);
      await interaction.reply({ content: 'Error setting reminder.', ephemeral: true });
    }
  }
};
