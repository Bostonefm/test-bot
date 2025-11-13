const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { pool } = require('../modules/db');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verification-list')
    .setDescription('List pending player verification requests (Admin only)'),

  async execute(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to view verification requests.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const guildId = interaction.guildId;

      // Get pending verification requests
      const result = await pool.query(
        `SELECT vr.discord_id, vr.ingame_name, vr.requested_at, vr.admin_notes,
                pl.linked_at
         FROM verification_requests vr
         JOIN player_links pl ON vr.discord_id = pl.discord_id AND vr.guild_id = pl.guild_id
         WHERE vr.guild_id = $1 AND pl.verified = FALSE
         ORDER BY vr.requested_at ASC`,
        [guildId]
      );

      if (result.rows.length === 0) {
        return interaction.editReply({
          content: '✅ **No pending verification requests!**\n\nAll linked players are verified.',
        });
      }

      // Format the list
      const pendingList = result.rows
        .map((row, index) => {
          const requestTime = Math.floor(new Date(row.requested_at).getTime() / 1000);
          return (
            `**${index + 1}.** <@${row.discord_id}>\n` +
            `🎮 **In-Game:** ${row.ingame_name}\n` +
            `⏰ **Requested:** <t:${requestTime}:R>\n` +
            `📝 **Command:** \`/verify-player <@${row.discord_id}>\``
          );
        })
        .join('\n\n');

      await interaction.editReply({
        content:
          `🔔 **Pending Player Verifications (${result.rows.length})**\n\n${pendingList}\n\n` +
          `💡 **Tip:** Use \`/verify-player @user [notes]\` to verify a player.`,
      });
    } catch (error) {
      logger.error('Verification list error:', error);
      await interaction.editReply({
        content: '❌ Failed to retrieve verification requests.',
      });
    }
  },
};
