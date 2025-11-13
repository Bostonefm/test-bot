const { SlashCommandBuilder } = require('discord.js');
const { getNitradoUsername, getAllGuildNitradoUsernames } = require('../modules/nitradoUserInfo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nitrado-users')
    .setDescription('Get Nitrado usernames for guild members')
    .addSubcommand(subcommand =>
      subcommand
        .setName('me')
        .setDescription('Get your Nitrado username')
        .addStringOption(option =>
          option.setName('service_id').setDescription('Your Nitrado service ID').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('all').setDescription('Get all Nitrado usernames in this guild')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'me') {
        const serviceId = interaction.options.getString('service_id');

        const username = await getNitradoUsername(
          interaction.guild.id,
          interaction.user.id,
          serviceId
        );

        await interaction.reply({
          content: `🎮 Your Nitrado username: **${username}**`,
          ephemeral: true,
        });
      } else if (subcommand === 'all') {
        const usernames = await getAllGuildNitradoUsernames(interaction.guild.id);

        if (usernames.length === 0) {
          await interaction.reply({
            content: '❌ No Nitrado users found in this guild.',
            ephemeral: true,
          });
          return;
        }

        const userList = usernames
          .map(u => `• <@${u.discordId}> → **${u.nitradoUsername}** (Service: ${u.serviceId})`)
          .join('\n');

        await interaction.reply({
          content: `🎮 **Nitrado Users in Guild:**\n\n${userList}`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Error getting Nitrado username:', error);
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
