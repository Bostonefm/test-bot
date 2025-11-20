// modules/logMonitoringManager.js
const logger = require('../config/logger.js');
const { getPool } = require('./db.js');
const { decrypt } = require('../utils/encryption.js');
const { createNitradoAPI } = require('./nitrado.js');

const { DayZLogAnalyzer } = require('./logAnalyzer.js');
const { NitradoLogProcessor } = require('./nitradoLogProcessor.js');

// Unified feed routing (auto-detect patterns → send to channels)
const { routeLogEvent } = require('./logRouter.js');

class LogMonitoringManager {
  constructor() {
    this.activeMonitors = new Map();     // guildId → { intervalId, … }
    this.filePositions = new Map();      // guildId:filename → { size, modified }

    this.logAnalyzer = new DayZLogAnalyzer();
    this.systemProcessor = new NitradoLogProcessor();
  }

  /* ============================================================
   *  START MONITORING (PER GUILD)
   * ============================================================ */
  async startMonitoring(guildId, client, opts = {}) {
    if (this.activeMonitors.has(guildId)) {
      logger.warn(`⚠️ Log monitor already active for guild ${guildId}`);
      return { success: false, message: 'Already active' };
    }

    try {
      const credentials = await this.getGuildCredentials(guildId);
      if (!credentials) throw new Error('No Nitrado credentials for guild');

      const { serviceId, token } = credentials;
      const api = createNitradoAPI(token);

      // 🔍 NEW: Auto-detect the correct DayZ directory
      const basePath = await api.findDayzPath(serviceId);
      if (!basePath) throw new Error('Unable to detect valid DayZ log directory');

      const monitor = {
        guildId,
        serviceId,
        token,
        api,
        basePath,
        client,
        interval: opts.interval || 60 * 1000, // check every 60 sec (safe)
      };

      monitor.intervalId = setInterval(() => {
        this.check(monitor);
      }, monitor.interval);

      this.activeMonitors.set(guildId, monitor);

      logger.info(`📂 Log monitoring started for guild ${guildId}`);
      await this.check(monitor); // run immediately

      return { success: true };
    } catch (err) {
      logger.error(`❌ Failed to start log monitoring manager: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /* ============================================================
   *  STOP MONITORING
   * ============================================================ */
  stopMonitoring(guildId) {
    const monitor = this.activeMonitors.get(guildId);
    if (!monitor) return { success: false };

    clearInterval(monitor.intervalId);
    this.activeMonitors.delete(guildId);

    logger.info(`🛑 Stopped log monitoring for guild ${guildId}`);
    return { success: true };
  }

  /* ============================================================
   *  MAIN CHECK FUNCTION
   * ============================================================ */
  async check(monitor) {
    const { guildId, client, api, serviceId, basePath } = monitor;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      logger.warn(`⚠️ Guild ${guildId} missing from cache`);
      return;
    }

    try {
      const res = await api.listFiles(serviceId, basePath);
      const files = res.data?.entries || [];

      const logFiles = files.filter(f =>
        (f.name || '').match(/DayZServer_PS4.*\.(ADM|RPT)$/)
      );

      if (!logFiles.length) {
        logger.warn(`⚠️ No DayZ log files found in ${basePath}`);
        return;
      }

      // pick newest ADM + newest RPT
      const targets = this.pickLatestTwo(logFiles);

      for (const file of targets) {
        await this.processFile(monitor, basePath, file, guild);
      }
    } catch (err) {
      logger.warn(`⚠️ Log polling error for guild ${guildId}: ${err.message}`);
    }
  }

  /* ============================================================
   *  PROCESS SINGLE FILE (ADM / RPT)
   * ============================================================ */
  async processFile(monitor, basePath, file, guild) {
    const { api, serviceId, guildId, client } = monitor;

    const name = file.name;
    const size = file.size || 0;
    const modified = new Date(file.modified_at * 1000);

    const key = `${guildId}:${name}`;
    const last = this.filePositions.get(key) || { size: 0, modified: new Date(0) };

    if (size <= last.size && modified <= last.modified) return;

    const path = `${basePath}/${name}`;
    const buf = await api.downloadFile(serviceId, path);

    if (!buf) return;

    const text = buf.toString('utf8');

    const newContent = size > last.size
      ? text.slice(last.size)
      : text;

    // 🔥 Analyze log content → events
    const events = this.logAnalyzer.processLogContent(newContent, path);

    if (events?.length) {
      logger.info(`🎯 Found ${events.length} new events in ${name}`);

      for (const evt of events) {
        const rawLine = evt.rawLine || evt.message || evt.raw;
        if (!rawLine) continue;

        // 🚀 Route to feed channels
        await routeLogEvent(rawLine, guild, client);
      }
    }

    this.filePositions.set(key, { size, modified });
  }

  /* ============================================================
   *  PICK NEWEST ADM + NEWEST RPT
   * ============================================================ */
  pickLatestTwo(files) {
    const adm = files
      .filter(f => f.name.endsWith('.ADM'))
      .sort((a, b) => b.modified_at - a.modified_at)[0];

    const rpt = files
      .filter(f => f.name.endsWith('.RPT'))
      .sort((a, b) => b.modified_at - a.modified_at)[0];

    return [adm, rpt].filter(Boolean);
  }

  /* ============================================================
   *  GET CREDENTIALS
   * ============================================================ */
  async getGuildCredentials(guildId) {
    const pool = await getPool();
    const q = await pool.query(
      `SELECT service_id, encrypted_token, token_iv, auth_tag 
       FROM nitrado_credentials 
       WHERE guild_id=$1 
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [guildId]
    );

    if (!q.rows.length) return null;

    const r = q.rows[0];
    return {
      serviceId: r.service_id,
      token: decrypt(r.encrypted_token, r.token_iv, r.auth_tag),
    };
  }
}

module.exports = {
  LogMonitoringManager,
  logMonitoringManager: new LogMonitoringManager()
};
