const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),

  async execute(interaction) {
    // Handle Discord.js race condition where reply succeeds but promise rejects
    try {
      await interaction.reply('Pong!');
    } catch (error) {
      // Ignore "Unknown interaction" if reply was already sent
      if (error.code !== 10062) {
        throw error;
      }
    }
  },
};
