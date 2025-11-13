const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPool } = require('../modules/db.js');
const logger = require('../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link-player')
    .setDescription('🔗 Link your Discord to your in-game character (must be online/spotted by Satellite first!)')
    .addStringOption(option =>
      option
        .setName('player-name')
        .setDescription('Your exact in-game name (check Satellite channel first!)')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const playerName = interaction.options.getString('player-name');
    const discordId = interaction.user.id;
    const guildId = interaction.guildId;
    const pool = await getPool();

    try {
      // 1️⃣ Already linked?
      const { rows: existing } = await pool.query(
        'SELECT * FROM player_links WHERE discord_id = $1 AND guild_id = $2',
        [discordId, guildId]
      );
      if (existing.length) {
        const link = existing[0];
        return interaction.editReply({
          content: `❌ You already have a linked character: **${link.ingame_name}**${link.verified ? ' ✅' : ' (unverified)'}`,
        });
      }

      // 2️⃣ Guild credentials
      const { rows: creds } = await pool.query(
        'SELECT service_id FROM nitrado_credentials WHERE guild_id = $1',
        [guildId]
      );
      if (!creds.length)
        return interaction.editReply('❌ This server has not been linked to a Nitrado service yet.');
      const serviceId = creds[0].service_id;

      // 3️⃣ Satellite verification
      const { rows: sightings } = await pool.query(
        `SELECT player_name, last_seen
           FROM player_status
          WHERE service_id = $1
            AND LOWER(player_name) = LOWER($2)
            AND status = 'online'
            AND last_seen > NOW() - INTERVAL '30 minutes'
          LIMIT 1`,
        [serviceId, playerName]
      );
      if (!sightings.length) {
        return interaction.editReply({
          content:
            `❌ **${playerName}** has not been spotted by Satellite in the past 30 minutes.\n\n` +
            `🛰️ **How to verify:**\n1️⃣ Join the DayZ server\n2️⃣ Wait for your name to appear in the Satellite channel\n3️⃣ Then run \`/link-player\` again.`,
        });
      }

      // 4️⃣ Name already claimed?
      const { rows: nameUsed } = await pool.query(
        'SELECT discord_id FROM player_links WHERE guild_id = $1 AND LOWER(ingame_name) = LOWER($2)',
        [guildId, playerName]
      );
      if (nameUsed.length) {
        return interaction.editReply({
          content: `❌ The player **${playerName}** is already linked to <@${nameUsed[0].discord_id}>.`,
        });
      }

      // 5️⃣ Insert verified link
      await pool.query(
        `INSERT INTO player_links (
           discord_id, guild_id, ingame_name, verified, verified_at,
           verification_notes, verified_by
         )
         VALUES ($1,$2,$3,TRUE,NOW(),$4,'satellite')
         ON CONFLICT (discord_id,guild_id)
         DO UPDATE SET verified=TRUE, verified_at=NOW(), verified_by='satellite'`,
        [discordId, guildId, playerName,
          `Verified via Satellite at ${new Date(sightings[0].last_seen).toISOString()}`]
      );

      // 6️⃣ Ensure economy account exists & active
      await pool.query(
        `INSERT INTO economy_accounts (discord_id,guild_id,balance,total_earned,total_spent,created_at)
         VALUES ($1,$2,0,0,0,NOW())
         ON CONFLICT (discord_id,guild_id) DO NOTHING`,
        [discordId, guildId]
      );
      await pool.query(
        `UPDATE economy_accounts
           SET active = TRUE
         WHERE discord_id = $1 AND guild_id = $2`,
        [discordId, guildId]
      );

      // 7️⃣ Create / update player_profiles
      await pool.query(
        `INSERT INTO player_profiles (
           guild_id, discord_id, ingame_name, verified, linked_at, last_seen, balance
         )
         VALUES ($1,$2,$3,TRUE,NOW(),NOW(),0)
         ON CONFLICT (guild_id,discord_id)
         DO UPDATE SET
           ingame_name = EXCLUDED.ingame_name,
           verified    = TRUE,
           linked_at   = NOW(),
           last_seen   = NOW()`,
        [guildId, discordId, playerName]
      );

      // 8️⃣ Assign Verified Player role
      let roleNote = '';
      try {
        const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified player');
        if (role) {
          const member = await interaction.guild.members.fetch(discordId);
          if (!member.roles.cache.has(role.id)) await member.roles.add(role);
          roleNote = `🏷️ You’ve been given the <@&${role.id}> role!`;
        }
      } catch (err) {
        logger.warn(`⚠️ Could not assign Verified Player role: ${err.message}`);
      }

      // 9️⃣ Success embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Player Linked Successfully!')
        .setDescription('You were spotted by Satellite and verified successfully.')
        .addFields(
          { name: '🎮 Player', value: playerName, inline: true },
          { name: '👤 Discord', value: `<@${discordId}>`, inline: true },
          { name: '🛰️ Verified', value: new Date(sightings[0].last_seen).toLocaleString(), inline: false },
          { name: '💰 Economy', value: 'Account active — use `/balance` to check your coins.', inline: false },
          ...(roleNote ? [{ name: '🏷️ Role', value: roleNote, inline: false }] : [])
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`🔗 Linked ${interaction.user.tag} ⇢ ${playerName} [guild ${guildId}]`);

    } catch (err) {
      logger.error('❌ /link-player failed:', err);
      await interaction.editReply('⚠️ An unexpected error occurred while linking.');
    }
  },
};
