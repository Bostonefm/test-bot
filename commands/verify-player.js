const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getPool } = require('../modules/db.js');
const logger = require('../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-player')
    .setDescription('✅ Manually verify or re-verify a linked player (admin/staff only).')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Discord user to verify.')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('player-name')
        .setDescription('Optional: Specify in-game name to verify.')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('note')
        .setDescription('Optional admin note (reason for manual verification).')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user');
    const playerName = interaction.options.getString('player-name');
    const note = interaction.options.getString('note') || 'Manually verified by admin';
    const guildId = interaction.guildId;
    const adminId = interaction.user.id;

    const pool = await getPool();

    try {
      // 🔍 Fetch existing link(s)
      let query = 'SELECT * FROM player_links WHERE discord_id = $1 AND guild_id = $2';
      const params = [target.id, guildId];

      if (playerName) {
        query += ' AND LOWER(ingame_name) = LOWER($3)';
        params.push(playerName);
      }

      const { rows: links } = await pool.query(query, params);

      if (!links.length) {
        return interaction.editReply({
          content: `❌ No existing link found for <@${target.id}>${playerName ? ` with name **${playerName}**` : ''}.`,
        });
      }

      // 🧾 Verify all matching entries
      const now = new Date();
      await pool.query(
        `UPDATE player_links
           SET verified = TRUE,
               verified_at = $1,
               verified_by = $2,
               verification_notes = $3
         WHERE discord_id = $4 AND guild_id = $5
           ${playerName ? 'AND LOWER(ingame_name) = LOWER($6)' : ''}`,
        playerName
          ? [now, adminId, note, target.id, guildId, playerName]
          : [now, adminId, note, target.id, guildId]
      );

      // 🪙 Reactivate their economy account (if disabled)
      await pool.query(
        `UPDATE economy_accounts
           SET active = TRUE
         WHERE discord_id = $1 AND guild_id = $2`,
        [target.id, guildId]
      ).catch(() => {});

      // 🏷 Assign Verified Player role if missing
      let roleNote = '';
      try {
        const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified player');
        if (role) {
          const member = await interaction.guild.members.fetch(target.id);
          if (!member.roles.cache.has(role.id)) await member.roles.add(role);
          roleNote = `Assigned <@&${role.id}>`;
        }
      } catch (err) {
        logger.warn(`⚠️ Failed to assign verified role: ${err.message}`);
      }

      // 📜 Confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Player Manually Verified')
        .addFields(
          { name: '👤 Discord', value: `<@${target.id}>`, inline: true },
          { name: '🎮 Player', value: playerName || links[0].ingame_name, inline: true },
          { name: '🧑‍💼 Verified By', value: `<@${adminId}>`, inline: false },
          { name: '📝 Note', value: note, inline: false },
          ...(roleNote ? [{ name: '🏷 Role', value: roleNote, inline: false }] : [])
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(`✅ Admin ${interaction.user.tag} verified ${target.tag} (${playerName || links[0].ingame_name}) in guild ${guildId}`);
    } catch (err) {
      logger.error('❌ /verify-player failed:', err);
      await interaction.editReply({
        content: `⚠️ Failed to verify player: ${err.message}`,
      });
    }
  },
};
