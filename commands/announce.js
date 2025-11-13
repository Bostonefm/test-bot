const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send announcement')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Announcement message')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('ping_role')
        .setDescription('Role to ping (optional)')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: '❌ You need Manage Messages permission.', ephemeral: true });
    }
    
    try {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      const pingRole = interaction.options.getRole('ping_role');
      
      let content = `📢 **Announcement**\n\n${message}`;
      if (pingRole) {
        content = `${pingRole} ${content}`;
      }
      
      await channel.send(content);
      await interaction.reply({ content: '✅ Announcement sent!', ephemeral: true });
    } catch (error) {
      console.error('Error sending announcement:', error);
      await interaction.reply({ content: 'Error sending announcement.', ephemeral: true });
    }
  }
};
