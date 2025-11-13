
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage-categories')
    .setDescription('Manage Discord channel categories'),
  
  async execute(interaction) {
    await interaction.reply({
      content: 'Category management feature is under development.',
      ephemeral: true
    });
  },
};
