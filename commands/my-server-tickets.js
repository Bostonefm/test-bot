
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('my-server-tickets')
    .setDescription('[Deprecated] Use /ticket-list to view your tickets')
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    await interaction.reply({
      content: '❌ **Command Deprecated**\n\nThis command has been replaced. Use `/ticket-list` to view all your tickets.\n\nAll ticket functionality is now integrated into **Grizzly Bot**.',
      ephemeral: true,
    });
  },
};
