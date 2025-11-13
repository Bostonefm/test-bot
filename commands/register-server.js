
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register-server')
    .setDescription('Server registration has been moved to our website')
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    await interaction.reply({
      content: '🌐 **Server Registration Moved!**\n\nServer registration and listings are now handled through our website at https://grizzlygaming-gg.com\n\nVisit the website to submit your server for listing and connect with the DayZ community.',
      ephemeral: true,
    });
  },
};
