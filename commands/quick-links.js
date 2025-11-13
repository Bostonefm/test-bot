const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quick-links')
    .setDescription('Access useful community and server links'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🔗 Quick Links - Community Resources')
      .setDescription('**Fast access to important Grizzly community resources**')
      .setColor(0x00D4AA)
      .addFields([
        {
          name: '🌐 **Official Links**',
          value: '[🏠 Main Website](https://grizzlygaming-gg.com)\n[📋 Commands Guide](https://grizzlygaming-gg.com/commands)\n[💡 Patreon Support](https://patreon.com/grizzlygaming)',
          inline: true
        },
        {
          name: '🛠️ **Support & Help**',
          value: '[🎫 Open Ticket](https://discord.com) - Use `/ticket-create`\n[📚 Documentation](https://docs.grizzlygaming-gg.com)\n[💬 Support Server](https://discord.gg/grizzly)',
          inline: true
        },
        {
          name: '🎮 **DayZ Servers**',
          value: '[🗺️ Server List](https://grizzlygaming-gg.com/servers)\n[📊 Server Stats](https://grizzlygaming-gg.com/stats)\n[🏆 Leaderboards](https://grizzlygaming-gg.com/leaderboard)',
          inline: true
        },
        {
          name: `🏠 **${interaction.guild.name} Specific**`,
          value: `**Server ID:** \`${interaction.guild.id}\`\n**Member Count:** ${interaction.guild.memberCount.toLocaleString()}\n**Created:** <t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:D>`,
          inline: false
        }
      ])
      .setFooter({ 
        text: '🤖 Grizzly Bot • Updated links',
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('🏠 Main Website')
          .setStyle(ButtonStyle.Link)
          .setURL('https://grizzlygaming-gg.com'),
        new ButtonBuilder()
          .setLabel('💰 Support on Patreon')
          .setStyle(ButtonStyle.Link)
          .setURL('https://patreon.com/grizzlygaming')
      );

    await interaction.reply({ 
      embeds: [embed], 
      components: [row],
      ephemeral: true 
    });
  }
};
