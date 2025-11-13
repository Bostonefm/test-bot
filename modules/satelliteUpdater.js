/**
 * modules/satelliteUpdater.js
 * Unified Satellite System — Multi-Guild Live Player Scanner
 * ----------------------------------------------------------
 * ✅ Fetches live player list from Nitrado API
 * ✅ Caches results in player_status for link verification
 * ✅ Updates Satellite channel embed (list of players currently online)
 * ✅ Smart change detection, fallback recovery & detailed logging
 * ✅ Supports instant refresh per guild (via forceRefreshGuild)
 * ✅ Includes rate-limiting to prevent Discord API spam
 * ✅ Handles empty lists and database fallback safely
 */

const { EmbedBuilder } = require("discord.js");
const { getPool } = require("../utils/db.js"); // ✅ Fixed import (correct Neon pool manager)
const logger = require("../config/logger.js"); // ✅ Fixed import path
const { decrypt } = require("../utils/encryption.js");
const { getNitradoPlayers } = require("./nitrado.js");

class SatelliteUpdater {
  constructor() {
    this.updateInterval = null;
    this.isUpdating = false;
    this.intervalMs = 5 * 60 * 1000; // 🔁 every 5 minutes
    this.lastPlayerLists = new Map(); // guildId → [playerNames]
    this.cooldowns = new Map(); // guildId → next allowed timestamp
    this.cooldownMs = 20 * 1000; // ⏱ 20s per guild update window
  }

  /** Begin periodic updates */
  startUpdating(client) {
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = setInterval(
      () => this.updateAllSatelliteChannels(client),
      this.intervalMs
    );
    logger.info(
      `🛰 SatelliteUpdater initialized — refresh every ${this.intervalMs / 60000} min`
    );
    this.updateAllSatelliteChannels(client); // Run immediately
  }

  stopUpdating() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = null;
    logger.warn("🛑 SatelliteUpdater stopped");
  }

  /** Update all guild Satellite channels */
  async updateAllSatelliteChannels(client) {
    if (this.isUpdating) return;
    this.isUpdating = true;

    const start = Date.now();
    logger.info("📡 Starting Satellite scan across all guilds...");

    try {
      const pool = await getPool();
      const { rows } = await pool.query(`
        SELECT guild_id, satellite_channel_id
        FROM guild_channels
        WHERE satellite_channel_id IS NOT NULL
      `);

      for (const { guild_id, satellite_channel_id } of rows) {
        await this.updateSatelliteChannel(client, guild_id, satellite_channel_id);
      }

      const duration = ((Date.now() - start) / 1000).toFixed(1);
      logger.info(`✅ Satellite update cycle complete (${rows.length} guilds, ${duration}s total)`);
    } catch (err) {
      logger.error("❌ Satellite global update failed:", err);
    } finally {
      this.isUpdating = false;
    }
  }

  /** Update a single guild’s Satellite channel */
  async updateSatelliteChannel(client, guildId, channelId) {
    try {
      const now = Date.now();
      const nextAllowed = this.cooldowns.get(guildId) || 0;

      // 🚦 Rate limit check
      if (now < nextAllowed) {
        const wait = ((nextAllowed - now) / 1000).toFixed(1);
        logger.debug(`[SATELLITE] ${guildId}: skipped (cooldown ${wait}s)`);
        return;
      }

      this.cooldowns.set(guildId, now + this.cooldownMs);

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        logger.warn(`[SATELLITE] Guild ${guildId} not found in cache.`);
        return;
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        logger.warn(`[SATELLITE] Channel ${channelId} not found in ${guild.name}`);
        return;
      }

      // Fetch live players and update DB
      const onlinePlayers = await this.getOnlinePlayers(guildId);
      const playerNames = onlinePlayers.map((p) => p.name);
      const prevList = this.lastPlayerLists.get(guildId) || [];

      // 🧠 Skip if unchanged
      if (JSON.stringify(prevList) === JSON.stringify(playerNames)) {
        logger.debug(`[SATELLITE] ${guild.name}: no changes (${playerNames.length} players)`);
        return;
      }

      this.lastPlayerLists.set(guildId, playerNames);
      const count = playerNames.length;

      // 🧭 Build Satellite embed
      const embed = new EmbedBuilder()
        .setTitle("🛰 Satellite Scan — Live Player List")
        .setColor(count > 0 ? 0x00ff00 : 0x666666)
        .setTimestamp()
        .setFooter({ text: `Last updated: ${new Date().toLocaleTimeString()}` })
        .setDescription(
          count > 0
            ? `**${count} survivor${count > 1 ? "s" : ""} online:**\n${playerNames
                .map((name) => `• ${name}`)
                .join("\n")}`
            : "*No players currently online*"
        );

      // 🪄 Find or create Satellite message
      const messages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
      const botMsg = messages?.find((msg) => msg.author.id === client.user.id);

      if (botMsg) {
        await botMsg.edit({ embeds: [embed] });
      } else {
        await channel.send({ embeds: [embed] });
      }

      logger.info(`📊 Satellite updated — ${guild.name}: ${count} player(s) online`);
    } catch (err) {
      logger.error(`❌ Error updating Satellite for guild ${guildId}: ${err.message}`);
    }
  }

  /** Retrieve live players via Nitrado API and safely update DB */
  async getOnlinePlayers(guildId) {
    const pool = await getPool();

    try {
      // Get credentials
      const { rows: creds } = await pool.query(
        `SELECT service_id, encrypted_token, token_iv, auth_tag
         FROM nitrado_credentials
         WHERE guild_id = $1 AND active = TRUE
         LIMIT 1`,
        [guildId]
      );

      if (!creds.length) {
        logger.warn(`[SATELLITE] No active credentials for guild ${guildId}`);
        return [];
      }

      const { service_id: serviceId, encrypted_token, token_iv, auth_tag } = creds[0];
      const token = decrypt(encrypted_token, token_iv, auth_tag);

      // Fetch Nitrado live players
      const livePlayers = await getNitradoPlayers(serviceId, token);
      const liveNames = Array.isArray(livePlayers) ? livePlayers.map((p) => p.name) : [];

      if (liveNames.length > 0) {
        for (const name of liveNames) {
          await pool.query(
            `INSERT INTO player_status (service_id, player_name, status, last_seen)
             VALUES ($1, $2, 'online', NOW())
             ON CONFLICT (service_id, player_name)
             DO UPDATE SET status = 'online', last_seen = NOW()`,
            [serviceId, name]
          );
        }

        // 🧹 Mark everyone else offline safely
        const placeholders = liveNames.map((_, i) => `$${i + 2}`).join(", ");
        if (placeholders.length > 0) {
          await pool.query(
            `UPDATE player_status
               SET status = 'offline', last_seen = NOW()
             WHERE service_id = $1
               AND LOWER(player_name) NOT IN (${placeholders})`,
            [serviceId, ...liveNames.map((n) => n.toLowerCase())]
          );
        } else {
          await pool.query(
            `UPDATE player_status
               SET status = 'offline', last_seen = NOW()
             WHERE service_id = $1`,
            [serviceId]
          );
        }
      } else {
        // 🧹 No players online — mark all offline safely
        await pool.query(
          `UPDATE player_status
             SET status = 'offline', last_seen = NOW()
           WHERE service_id = $1`,
          [serviceId]
        );
      }

      logger.debug(`[SATELLITE] ${guildId}: ${liveNames.length} online, DB updated.`);

      // 🧩 Fallback — use cached recent online players if API is empty
      if (!Array.isArray(livePlayers) || livePlayers.length === 0) {
        const { rows } = await pool.query(
          `SELECT DISTINCT player_name
             FROM player_status
            WHERE service_id = $1
              AND status = 'online'
              AND last_seen > NOW() - INTERVAL '10 minutes'`,
          [serviceId]
        );
        if (rows.length > 0)
          logger.warn(`[SATELLITE] ${guildId}: Using cached players (${rows.length})`);
        return rows.map((r) => ({ name: r.player_name }));
      }

      return livePlayers.map((p) => ({ name: p.name }));
    } catch (err) {
      logger.error(`[SATELLITE] getOnlinePlayers() failed for ${guildId}: ${err.message}`);
      return [];
    }
  }

  /** 🔄 Force an instant refresh for a guild */
  async forceRefreshGuild(client, guildId) {
    try {
      const pool = await getPool();
      const { rows } = await pool.query(
        `SELECT satellite_channel_id
           FROM guild_channels
          WHERE guild_id = $1 AND satellite_channel_id IS NOT NULL`,
        [guildId]
      );

      if (!rows.length) {
        logger.debug(`[SATELLITE] No satellite channel found for guild ${guildId}`);
        return;
      }

      const { satellite_channel_id } = rows[0];
      await this.updateSatelliteChannel(client, guildId, satellite_channel_id);
      logger.info(`[SATELLITE] 🔁 Forced refresh triggered for guild ${guildId}`);
    } catch (err) {
      logger.error(`[SATELLITE] forceRefreshGuild() failed for ${guildId}: ${err.message}`);
    }
  }
}

// ✅ Export shared instance
module.exports = new SatelliteUpdater();
