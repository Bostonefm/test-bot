const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View Discord profile information and stats')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to view profile for (leave blank for yourself)')
        .setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const targetMember = interaction.guild.members.cache.get(targetUser.id);
    
    if (!targetMember) {
      return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
    }

    const joinPosition = interaction.guild.members.cache
      .filter(member => member.joinedTimestamp < targetMember.joinedTimestamp)
      .size + 1;

    const roles = targetMember.roles.cache
      .filter(role => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => role.toString())
      .slice(0, 10);

    const status = targetMember.presence?.status || 'offline';
    const statusEmoji = {
      'online': '🟢',
      'idle': '🟡', 
      'dnd': '🔴',
      'offline': '⚫'
    };

    const accountCreated = Math.floor(targetUser.createdTimestamp / 1000);
    const serverJoined = Math.floor(targetMember.joinedTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.displayName}`)
      .setColor(targetMember.displayHexColor === '#000000' ? 0x5865F2 : parseInt(targetMember.displayHexColor.slice(1), 16))
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields([
        {
          name: '📊 **Basic Info**',
          value: `**Username:** ${targetUser.username}\n**Display Name:** ${targetUser.displayName}\n**User ID:** \`${targetUser.id}\`\n**Status:** ${statusEmoji[status]} ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          inline: true
        },
        {
          name: '📅 **Dates**',
          value: `**Account Created:** <t:${accountCreated}:D>\n**Joined Server:** <t:${serverJoined}:D>\n**Join Position:** #${joinPosition.toLocaleString()}`,
          inline: true
        },
        {
          name: '🏷️ **Server Stats**',
          value: `**Nickname:** ${targetMember.nickname || 'None'}\n**Roles:** ${targetMember.roles.cache.size - 1}\n**Highest Role:** ${targetMember.roles.highest.toString()}\n**Boosting:** ${targetMember.premiumSince ? '✅ Yes' : '❌ No'}`,
          inline: true
        }
      ])
      .setFooter({ 
        text: `🤖 Grizzly Bot${targetUser.bot ? ' • This user is a bot' : ''}`,
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    if (roles.length > 0) {
      embed.addFields({
        name: `🎭 **Roles (${targetMember.roles.cache.size - 1})**`,
        value: roles.join(' ') + (targetMember.roles.cache.size - 1 > 10 ? ` +${targetMember.roles.cache.size - 11} more` : ''),
        inline: false
      });
    }

    if (targetMember.presence?.activities?.length > 0) {
      const activity = targetMember.presence.activities[0];
      embed.addFields({
        name: '🎮 **Activity**',
        value: `**${activity.type === 0 ? 'Playing' : activity.type === 1 ? 'Streaming' : activity.type === 2 ? 'Listening to' : activity.type === 3 ? 'Watching' : 'Custom'}:** ${activity.name}`,
        inline: true
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
