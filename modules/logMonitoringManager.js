const logger = require('../config/logger.js');
const { getPool } = require('../modules/db.js');
const { decrypt } = require('../utils/encryption');
const { createNitradoAPI } = require('./nitrado');
const { DayZLogAnalyzer } = require('./logAnalyzer');
const { NitradoLogProcessor } = require('./nitradoLogProcessor');
const DiscordNotificationSystem = require('./discordNotifications.js');

/**
 * 🧠 Unified Log Monitoring Manager
 * Combines Nitrado system logs + DayZ in-game logs (killfeed, bases, etc.)
 */
class LogMonitoringManager {
  constructor() {
    this.activeMonitors = new Map();         // guildId → monitor config
    this.logAnalyzer = new DayZLogAnalyzer(); // DayZ killfeed etc.
    this.systemLogProcessor = new NitradoLogProcessor(); // Nitrado system alerts
    this.notificationSystem = null;
    this.defaultInterval = 300000;           // 5 min polling
    this.filePositions = new Map();          // last-read positions
  }

  /** ───────────────────────────────────────────────
   *  Start monitoring for a guild
   * ─────────────────────────────────────────────── */
  async startMonitoring(guildId, discordClient, options = {}) {
    if (this.activeMonitors.has(guildId)) {
      logger.warn(`📋 Monitoring already active for guild ${guildId}`);
      return { success: false, message: 'Already monitoring' };
    }

    try {
      this.notificationSystem = new DiscordNotificationSystem(discordClient);

      // 🔐 get token
      const credentials = await this.getGuildCredentials(guildId);
      if (!credentials) throw new Error('No Nitrado credentials found for this guild');

      const { serviceId, token } = credentials;
      const api = createNitradoAPI(token);

      // 🗂 discover working log paths
      const serverPaths = await this.discoverServerPaths(api, serviceId);
      if (!serverPaths.success) {
        throw new Error(`Failed to discover server paths: ${serverPaths.error}`);
      }

      const monitorConfig = {
        guildId,
        serviceId,
        token,
        api,
        paths: serverPaths.paths,
        interval: options.interval || this.defaultInterval,
        isActive: true,
        lastCheck: 0,
        eventsProcessed: 0,
        startTime: Date.now()
      };

      // Schedule interval
      monitorConfig.intervalId = setInterval(
        () => this.checkForLogUpdates(monitorConfig),
        monitorConfig.interval
      );

      this.activeMonitors.set(guildId, monitorConfig);

      // Run first check immediately
      await this.checkForLogUpdates(monitorConfig);

      logger.info(`🎯 Started log monitoring for guild ${guildId}, service ${serviceId}`);
      return { success: true, paths: serverPaths.paths, interval: monitorConfig.interval };

    } catch (error) {
      logger.error(`❌ Failed to start monitoring for guild ${guildId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /** Stop monitoring */
  stopMonitoring(guildId) {
    const monitor = this.activeMonitors.get(guildId);
    if (!monitor) return { success: false, message: 'No active monitoring' };

    clearInterval(monitor.intervalId);
    this.activeMonitors.delete(guildId);
    for (const key of Array.from(this.filePositions.keys()).filter(k => k.startsWith(guildId)))
      this.filePositions.delete(key);

    logger.info(`🛑 Stopped monitoring for guild ${guildId}`);
    return { success: true };
  }

  /** Poll all known paths for updates */
  async checkForLogUpdates(monitorConfig) {
    if (!monitorConfig.isActive) return;
    const { api, serviceId, guildId, paths } = monitorConfig;

    try {
      logger.debug(`🔍 Checking for log updates — Guild: ${guildId}, Service: ${serviceId}`);

      for (const path of paths) {
        await this.processPath(api, serviceId, guildId, path, monitorConfig);
      }

      monitorConfig.lastCheck = Date.now();
    } catch (err) {
      logger.error(`❌ Error checking logs for guild ${guildId}:`, err);
    }
  }

  /** Scan directory for latest ADM / RPT logs */
  async processPath(api, serviceId, guildId, path, monitorConfig) {
    try {
      const response = await api.listFiles(serviceId, path);
      const files = response.data?.entries || [];

      const logFiles = files.filter(f => {
        const n = f.name || f.filename || '';
        return (n.endsWith('.ADM') || n.endsWith('.RPT')) &&
               (n.includes('DayZServer_PS4') || n.includes('dayzps'));
      });
      if (logFiles.length === 0) return;

      for (const file of this.getLatestLogFiles(logFiles)) {
        await this.processLogFile(api, serviceId, guildId, path, file, monitorConfig);
      }
    } catch (e) {
      logger.warn(`⚠️ Error processing path ${path}: ${e.message}`);
    }
  }

  /** Parse a single file’s new content */
  async processLogFile(api, serviceId, guildId, basePath, file, monitorConfig) {
    try {
      const fileName = file.name || file.filename;
      const fileSize = file.size || 0;
      const lastModified = new Date((file.modified_at || file.created_at || 0) * 1000);

      const key = `${guildId}:${fileName}`;
      const lastPos = this.filePositions.get(key) || { size: 0, modified: new Date(0) };

      if (fileSize <= lastPos.size && lastModified <= lastPos.modified) return;

      const filePath = `${basePath}/${fileName}`;
      const buf = await api.downloadFile(serviceId, filePath);
      if (!buf || buf.length === 0) return;

      const content = buf.toString('utf8');
      const slice = fileSize > lastPos.size ? content.slice(lastPos.size) : content;

      // 🔍 analyze game logs
      const events = this.logAnalyzer.processLogContent(slice, serviceId, fileName);

      if (events.length > 0) {
        logger.info(`🎯 Found ${events.length} new events in ${fileName}`);
        if (this.notificationSystem)
          await this.notificationSystem.processEvents(events, guildId);
        monitorConfig.eventsProcessed += events.length;
      }

      this.filePositions.set(key, { size: fileSize, modified: lastModified });
    } catch (err) {
      logger.error(`❌ Error processing file ${file.name}:`, err);
    }
  }

  /** Get newest ADM + RPT */
  getLatestLogFiles(files) {
    const pick = ext => {
      const group = files.filter(f => (f.name || f.filename).endsWith(ext));
      if (group.length === 0) return null;
      return group.reduce((a, b) => ((b.modified_at || 0) > (a.modified_at || 0) ? b : a));
    };
    return [pick('.ADM'), pick('.RPT')].filter(Boolean);
  }

  /** Test possible paths */
  async discoverServerPaths(api, serviceId) {
    const paths = [
      '/games/ni8504127_1/noftp/dayzps/config',
      '/games/ni8504127_1/ftproot/dayzps/config',
      '/noftp/dayzps/config',
      '/ftproot/dayzps/config'
    ];
    const working = [];
    for (const p of paths) {
      try {
        const res = await api.listFiles(serviceId, p);
        const entries = res.data?.entries || [];
        if (entries.some(f => (f.name || '').match(/DayZServer_PS4.*\.(ADM|RPT)$/))) {
          working.push(p);
          logger.info(`✅ Found log files at ${p}`);
        }
      } catch (err) {
        logger.debug(`❌ Path ${p} not accessible: ${err.message}`);
      }
    }
    return { success: working.length > 0, paths: working, error: working.length ? null : 'No accessible log paths' };
  }

  /** Retrieve guild token */
  async getGuildCredentials(guildId) {
    try {
      const pool = await getPool();
      const q = await pool.query(
        'SELECT service_id, encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE guild_id=$1 AND service_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1',
        [guildId]
      );
      if (!q.rows.length) return null;
      const { service_id, encrypted_token, token_iv, auth_tag } = q.rows[0];
      return { serviceId: service_id, token: decrypt(encrypted_token, token_iv, auth_tag) };
    } catch (err) {
      logger.error('Error getting guild credentials:', err);
      return null;
    }
  }

  /** Other helpers (status, interval, forceCheck) omitted for brevity */
}

const logMonitoringManager = new LogMonitoringManager();
module.exports = { LogMonitoringManager, logMonitoringManager };
