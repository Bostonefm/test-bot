const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { pool } = require('../modules/db');
const { createNitradoAPI } = require('../modules/nitrado');
const { decrypt } = require('../utils/encryption');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auto-verify-online')
    .setDescription('Auto-verify all pending requests for players currently online (Admin only)'),

  async execute(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const guildId = interaction.guildId;

      // Get Nitrado credentials
      const credsResult = await pool.query(
        'SELECT * FROM nitrado_credentials WHERE guild_id = $1',
        [guildId]
      );

      if (credsResult.rows.length === 0) {
        return interaction.editReply({
          content: '❌ No Nitrado connection found. Use `/connect-nitrado` first.',
        });
      }

      const creds = credsResult.rows[0];
      const api = createNitradoAPI(decrypt(creds.token_encrypted, creds.token_iv));

      // Get online players
      const playersResult = await api.getPlayers(creds.service_id);
      if (!playersResult.success) {
        return interaction.editReply({
          content: `❌ Failed to get online players: ${playersResult.error}`,
        });
      }

      const onlinePlayers = playersResult.data.map(p => p.name.toLowerCase());

      // Get pending verification requests
      const pendingResult = await pool.query(
        `SELECT vr.*, pl.discord_id as existing_link
         FROM verification_requests vr
         LEFT JOIN player_links pl ON vr.discord_id = pl.discord_id AND vr.guild_id = pl.guild_id
         WHERE vr.guild_id = $1 AND vr.status = 'pending'
         ORDER BY vr.requested_at ASC`,
        [guildId]
      );

      if (pendingResult.rows.length === 0) {
        return interaction.editReply({
          content: '✅ No pending verification requests found.',
        });
      }

      let verifiedCount = 0;
      let skippedCount = 0;
      const verifiedPlayers = [];

      for (const request of pendingResult.rows) {
        const isOnline = onlinePlayers.includes(request.ingame_name.toLowerCase());

        if (isOnline && !request.existing_link) {
          try {
            // Create player link
            await pool.query(
              'INSERT INTO player_links (discord_id, guild_id, ingame_name, verified, verified_by, verified_at, verification_notes) VALUES ($1, $2, $3, $4, $5, NOW(), $6)',
              [
                request.discord_id,
                request.guild_id,
                request.ingame_name,
                true,
                interaction.user.id,
                'Bulk auto-verified: Player was online',
              ]
            );

            // Update verification request
            await pool.query(
              'UPDATE verification_requests SET status = $1, verified_by = $2, verified_at = NOW() WHERE discord_id = $3 AND guild_id = $4',
              ['approved', interaction.user.id, request.discord_id, request.guild_id]
            );

            verifiedCount++;
            verifiedPlayers.push(`<@${request.discord_id}> → ${request.ingame_name}`);

            // Notify the user
            try {
              const user = await interaction.client.users.fetch(request.discord_id);
              const embed = new EmbedBuilder()
                .setTitle('✅ Verification Approved!')
                .setColor(0x00ff00)
                .setDescription('Your character link has been approved!')
                .addFields([
                  { name: 'In-game Name', value: request.ingame_name, inline: true },
                  { name: 'Verified By', value: interaction.user.tag, inline: true },
                  { name: 'Method', value: 'Bulk Auto-Verify', inline: true },
                ])
                .setTimestamp();

              await user.send({ embeds: [embed] });
            } catch (dmError) {
              logger.warn(`Could not DM user ${request.discord_id}:`, dmError.message);
            }
          } catch (error) {
            logger.error(`Failed to verify ${request.ingame_name}:`, error);
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🤖 Bulk Auto-Verification Complete')
        .setColor(verifiedCount > 0 ? 0x00ff00 : 0xffaa00)
        .addFields([
          { name: 'Verified', value: `${verifiedCount} players`, inline: true },
          { name: 'Skipped', value: `${skippedCount} players`, inline: true },
          { name: 'Total Processed', value: `${pendingResult.rows.length} requests`, inline: true },
        ]);

      if (verifiedPlayers.length > 0) {
        embed.addFields([
          {
            name: 'Verified Players',
            value:
              verifiedPlayers.slice(0, 10).join('\n') +
              (verifiedPlayers.length > 10 ? '\n... and more' : ''),
            inline: false,
          },
        ]);
      }

      embed
        .setFooter({ text: 'Players were verified because they were found online' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Bulk auto-verify error:', error);
      await interaction.editReply({
        content: '❌ Failed to perform bulk auto-verification.',
      });
    }
  },
};
