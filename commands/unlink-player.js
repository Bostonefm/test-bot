const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getPool } = require('../modules/db.js');
const logger = require('../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink-player')
    .setDescription('🔓 Unlink your in-game character or remove another user’s link (admin only).')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to unlink (admin-only).')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const requesterId = interaction.user.id;
    const guildId = interaction.guildId;
    const pool = await getPool();

    try {
      // 1️⃣ Determine if this is admin unlink or self unlink
      const member = await interaction.guild.members.fetch(requesterId);
      const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild) && targetUser;
      const unlinkId = isAdmin ? targetUser.id : requesterId;

      // 2️⃣ Get linked players
      const { rows: links } = await pool.query(
        `SELECT ingame_name FROM player_links 
         WHERE discord_id = $1 AND guild_id = $2`,
        [unlinkId, guildId]
      );

      if (links.length === 0) {
        return interaction.editReply({
          content: `❌ No linked player(s) found for <@${unlinkId}>.`,
        });
      }

      // 3️⃣ Delete the links
      await pool.query(
        `DELETE FROM player_links 
         WHERE discord_id = $1 AND guild_id = $2`,
        [unlinkId, guildId]
      );

      // 4️⃣ Deactivate their economy account (keep balance history)
      await pool.query(
        `UPDATE economy_accounts
           SET active = FALSE
         WHERE discord_id = $1 AND guild_id = $2`,
        [unlinkId, guildId]
      ).catch(() => {});

      // 5️⃣ Try removing Verified Player role
      let roleRemoved = false;
      try {
        const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified player');
        if (role) {
          const memberToUpdate = await interaction.guild.members.fetch(unlinkId);
          if (memberToUpdate.roles.cache.has(role.id)) {
            await memberToUpdate.roles.remove(role);
            roleRemoved = true;
          }
        }
      } catch (err) {
        logger.warn(`⚠️ Could not remove Verified Player role: ${err.message}`);
      }

      // 6️⃣ Build confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('🔓 Player Unlinked')
        .setDescription(
          isAdmin
            ? `🛠️ Administrator <@${requesterId}> has unlinked <@${unlinkId}>.`
            : `Your player link has been removed. You can re-link anytime with \`/link-player\`.`
        )
        .addFields(
          { name: '👤 Discord User', value: `<@${unlinkId}>`, inline: true },
          { name: '🎮 Characters Removed', value: links.map(l => l.ingame_name).join(', '), inline: false },
          { name: '🕒 Time', value: new Date().toLocaleString(), inline: false },
          ...(roleRemoved
            ? [{ name: '🏷️ Role', value: 'Verified Player role removed.', inline: false }]
            : [])
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`🔓 ${isAdmin ? 'Admin' : 'User'} unlink performed: ${requesterId} → ${unlinkId} (${links.length} link(s))`);
    } catch (error) {
      logger.error('❌ /unlink-player failed:', error);
      await interaction.editReply({
        content: `⚠️ Failed to unlink player: ${error.message}`,
      });
    }
  },
};
