// ============================================================
// 🧩 Grizzly Bot — Cleaned Module: nitradoUserInfo.js
// Fetch and manage Nitrado player info (for linked Discord users)
// ============================================================

const logger = require('../config/logger.js');
const { getPool } = require('../utils/db.js');
const { createNitradoAPI } = require('./nitrado.js');
const { decrypt } = require('../utils/encryption.js');

// ─────────────────────────────────────────────
// 👤 Nitrado User Info Manager
// ─────────────────────────────────────────────
class NitradoUserInfo {
  constructor() {}

  // 🧭 Get linked Nitrado player list for a guild
  async getOnlinePlayers(guildId) {
    const pool = getPool();

    try {
      const { rows } = await pool.query(`
        SELECT service_id, encrypted_token, token_iv, auth_tag
        FROM nitrado_credentials
        WHERE guild_id = $1 AND active = TRUE
      `, [guildId]);

      if (!rows.length) {
        logger.warn(`⚠️ No Nitrado credentials found for guild ${guildId}.`);
        return [];
      }

      const creds = rows[0];
      const token = decrypt(creds.encrypted_token, creds.token_iv, creds.auth_tag);
      const api = createNitradoAPI(token);

      const status = await api.getServiceInfo(creds.service_id);
      const players = status?.players || [];

      logger.info(`👥 ${players.length} player(s) online for guild ${guildId}`);
      return players;
    } catch (err) {
      logger.error(`❌ Failed to fetch online players for guild ${guildId}: ${err.message}`);
      return [];
    }
  }

  // 🧾 Get full DayZ player data (including position, gear, etc.)
  async getPlayerDetails(guildId, playerId) {
    const pool = getPool();

    try {
      const { rows } = await pool.query(`
        SELECT service_id, encrypted_token, token_iv, auth_tag
        FROM nitrado_credentials
        WHERE guild_id = $1 AND active = TRUE
      `, [guildId]);

      if (!rows.length) throw new Error('No active Nitrado credentials found.');

      const creds = rows[0];
      const token = decrypt(creds.encrypted_token, creds.token_iv, creds.auth_tag);
      const api = createNitradoAPI(token);

      const result = await api.getPlayerDetails(creds.service_id, playerId);
      if (!result || !result.data) throw new Error('Invalid or empty response from Nitrado API.');

      logger.debug(`📄 Retrieved data for player ${playerId} in guild ${guildId}`);
      return result.data;
    } catch (err) {
      logger.error(`❌ Error retrieving player info (${playerId}): ${err.message}`);
      return null;
    }
  }

  // 🔗 Find linked player by Discord user
  async findLinkedPlayer(discordId) {
    const pool = getPool();
    try {
      const { rows } = await pool.query(`
        SELECT * FROM grizzly_users WHERE discord_id = $1 LIMIT 1
      `, [discordId]);

      if (rows.length === 0) {
        logger.warn(`⚠️ No linked player found for Discord user ${discordId}`);
        return null;
      }

      const user = rows[0];
      logger.info(`🔗 Found linked player: ${user.player_name} (${user.player_uid})`);
      return user;
    } catch (err) {
      logger.error(`❌ Failed to lookup linked player for ${discordId}: ${err.message}`);
      return null;
    }
  }

  // 🧩 Sync player link (used after verification or Patreon sync)
  async syncLinkedPlayer(discordId, playerUid, playerName, guildId) {
    const pool = getPool();
    try {
      await pool.query(`
        INSERT INTO grizzly_users (discord_id, player_uid, player_name, guild_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (discord_id)
        DO UPDATE SET player_uid = EXCLUDED.player_uid, player_name = EXCLUDED.player_name
      `, [discordId, playerUid, playerName, guildId]);

      logger.info(`✅ Synced linked player ${playerName} (${playerUid}) for user ${discordId}`);
      return true;
    } catch (err) {
      logger.error(`❌ Failed to sync linked player for ${discordId}: ${err.message}`);
      return false;
    }
  }
}

module.exports = new NitradoUserInfo();
