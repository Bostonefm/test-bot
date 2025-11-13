// modules/livePlayerPoller.js
const logger = require('../config/logger.js');
const { getPool } = require('../utils/db.js');
const { createNitradoAPI } = require('./nitrado.js');
const { decrypt } = require('../utils/encryption.js');
const { EmbedBuilder } = require('discord.js');

class LivePlayerPoller {
  constructor() {
    this.interval = 5 * 60 * 1000; // 5 minutes
    this.activePlayers = new Map(); // guildId -> { playerName: { lastSeen, connectedAt } }
    this.isRunning = false;
  }

  async start(client) {
    if (this.isRunning) {
      logger.info('📡 Live Player Poller already running.');
      return;
    }

    this.isRunning = true;
    logger.info('🛰 Starting Live Player Poller...');

    const pool = getPool();
    const creds = await pool.query(`
      SELECT guild_id, service_id, encrypted_token, token_iv, auth_tag
      FROM nitrado_credentials
      WHERE active = TRUE
    `);

    if (!creds.rows.length) {
      logger.warn('⚠️ No Nitrado credentials found for live poller.');
      return;
    }

    // Run immediately, then repeat every interval
    await this.runPoll(client, creds.rows);
    setInterval(() => this.runPoll(client, creds.rows), this.interval);
  }

  async runPoll(client, creds) {
    for (const row of creds) {
      const { guild_id, service_id, encrypted_token, token_iv, auth_tag } = row;
      await this.pollGuild(client, guild_id, service_id, encrypted_token, token_iv, auth_tag);
    }
  }

  async pollGuild(client, guildId, serviceId, encToken, iv, tag) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;

      const token = decrypt(encToken, iv, tag);
      const api = createNitradoAPI(token);

      // 🔍 Get current player list from Nitrado
      const data = await api.getPlayers(serviceId);
      const currentPlayers = data?.data?.players || [];

      const knownPlayers = this.activePlayers.get(guildId) || {};

      // 🟢 Handle new connections or still-active players
      for (const player of currentPlayers) {
        const name = player.name;
        if (!knownPlayers[name]) {
          knownPlayers[name] = { lastSeen: new Date(), connectedAt: new Date() };
          await this.sendConnectionMessage(guild, name, true);
        } else {
          knownPlayers[name].lastSeen = new Date();
          await this.updateSatelliteStatus(guild, name, true);
        }
      }

      // 🔴 Handle disconnections
      for (const name in knownPlayers) {
        const stillOnline = currentPlayers.some(p => p.name === name);
        if (!stillOnline) {
          await this.sendConnectionMessage(guild, name, false);
          await this.updateSatelliteStatus(guild, name, false);
          delete knownPlayers[name];
        }
      }

      this.activePlayers.set(guildId, knownPlayers);
    } catch (err) {
      logger.error(`[LivePoller] Error updating guild ${guildId}: ${err.message}`);
    }
  }

  async sendConnectionMessage(guild, playerName, connected) {
    try {
      const channel = guild.channels.cache.find(c => c.name.toLowerCase().includes('connections'));
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(connected ? 0x2ecc71 : 0xe74c3c)
        .setTitle(connected ? `🟢 Player Connected` : `🔴 Player Disconnected`)
        .setDescription(`${playerName} ${connected ? 'joined the server' : 'left the server'}`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn(`⚠️ Failed to send connection message: ${err.message}`);
    }
  }

  async updateSatelliteStatus(guild, playerName, online) {
    try {
      const satelliteChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('satellite'));
      if (!satelliteChannel) return;

      if (online) {
        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`📍 ${playerName}`)
          .setDescription(`🕓 Last seen ${new Date().toLocaleTimeString()}`)
          .setFooter({ text: 'Active Player' });

        await satelliteChannel.send({ embeds: [embed] });
      } else {
        const messages = await satelliteChannel.messages.fetch({ limit: 50 });
        const playerMsg = messages.find(m => m.embeds[0]?.title?.includes(playerName));
        if (playerMsg) await playerMsg.delete().catch(() => {});
      }
    } catch (err) {
      logger.warn(`⚠️ Failed to update Satellite for ${playerName}: ${err.message}`);
    }
  }
}

const livePoller = new LivePlayerPoller();
module.exports = { livePoller };
