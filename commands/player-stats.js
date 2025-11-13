const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPool } = require('../modules/db.js');
const logger = require('../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('player-stats')
    .setDescription('📊 View player information, stats, and economy balance')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Discord user to view stats for (leave empty for yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;
    const pool = await getPool();

    try {
      // 1️⃣ Fetch linked player name
      const { rows: links } = await pool.query(
        `SELECT ingame_name, verified, verified_at 
           FROM player_links 
          WHERE guild_id = $1 AND discord_id = $2 
          LIMIT 1`,
        [guildId, targetUser.id]
      );

      if (!links.length) {
        return interaction.editReply({
          content: `❌ No linked character found for **${targetUser.username}**. They must link with \`/link-player\` first.`,
        });
      }

      const link = links[0];

      // 2️⃣ Get last known status info
      const { rows: status } = await pool.query(
        `SELECT status, last_seen 
           FROM player_status 
          WHERE player_name = $1 
          ORDER BY last_seen DESC 
          LIMIT 1`,
        [link.ingame_name]
      );

      // 3️⃣ Get economy stats
      const { rows: eco } = await pool.query(
        `SELECT balance, total_earned, total_spent, created_at 
           FROM economy_accounts 
          WHERE guild_id = $1 AND discord_id = $2`,
        [guildId, targetUser.id]
      );

      const economy = eco[0] || { balance: 0, total_earned: 0, total_spent: 0, created_at: null };

      // 4️⃣ Build embed
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📊 Player Stats: ${link.ingame_name}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Discord', value: `<@${targetUser.id}>`, inline: true },
          { name: '🎮 In-Game Name', value: link.ingame_name, inline: true },
          { name: '✅ Verified', value: link.verified ? 'Yes' : 'No', inline: true },
          {
            name: '🛰️ Last Seen',
            value: status[0]?.last_seen
              ? new Date(status[0].last_seen).toLocaleString()
              : 'Unknown',
            inline: true
          },
          {
            name: '📶 Status',
            value: status[0]?.status === 'online' ? '🟢 Online' : '🔴 Offline',
            inline: true
          },
          { name: '💰 Balance', value: `${economy.balance.toLocaleString()} coins`, inline: true },
          { name: '📈 Total Earned', value: `${economy.total_earned.toLocaleString()}`, inline: true },
          { name: '📉 Total Spent', value: `${economy.total_spent.toLocaleString()}`, inline: true },
          {
            name: '🕒 Account Created',
            value: economy.created_at
              ? new Date(economy.created_at).toLocaleDateString()
              : 'N/A',
            inline: true
          }
        )
        .setFooter({ text: `Grizzly Bot Player Stats • ${interaction.guild.name}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`📊 Player stats viewed for ${targetUser.tag} in guild ${guildId}`);
    } catch (error) {
      logger.error('❌ Error in /player-stats:', error);
      await interaction.editReply({
        content: `⚠️ Failed to fetch stats: ${error.message}`,
      });
    }
  },
};
