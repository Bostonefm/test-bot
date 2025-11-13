const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Poll question')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('option1')
        .setDescription('First option')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('option2')
        .setDescription('Second option')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('option3')
        .setDescription('Third option')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('option4')
        .setDescription('Fourth option')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && 
        !interaction.member.roles.cache.some(role => ['Admin', 'Moderator', 'Staff'].includes(role.name))) {
      return interaction.reply({ content: '❌ You need Staff permissions to create polls.', ephemeral: true });
    }

    try {
      const question = interaction.options.getString('question');
      const options = [
        interaction.options.getString('option1'),
        interaction.options.getString('option2'),
        interaction.options.getString('option3'),
        interaction.options.getString('option4')
      ].filter(Boolean);

      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
      const pollContent = `📊 **${question}**\n\n` +
        options.map((option, index) => `${emojis[index]} ${option}`).join('\n');

      const pollMessage = await interaction.reply({ content: pollContent, fetchReply: true });

      for (let i = 0; i < options.length; i++) {
        await pollMessage.react(emojis[i]);
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      await interaction.reply({ content: 'Error creating poll.', ephemeral: true });
    }
  }
};
