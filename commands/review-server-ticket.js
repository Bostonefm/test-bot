
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review-server-ticket')
    .setDescription('[Deprecated] Use /ticket-list, /ticket-priority, or /ticket-close instead')
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    await interaction.reply({
      content: '❌ **Command Deprecated**\n\nThis command has been replaced. Use the following instead:\n\n• `/ticket-list` - View all tickets\n• `/ticket-priority` - Change ticket priority\n• `/ticket-close` - Close a ticket\n\nAll ticket management is now integrated into **Grizzly Bot**.',
      ephemeral: true,
    });
  },
};
