// modules/logMonitoringManager.js
// ============================================================
// 🧩 Grizzly Bot — Log Monitoring Manager
//  - Per-guild Nitrado polling
//  - Uses DayZLogAnalyzer to parse log content
//  - Routes events to Discord feeds via logRouter → feed-manage
// ============================================================

const logger = require('../config/logger.js');
const { getPool } = require('../utils/db.js'); // ⬅ change to ../modules/db.js if needed
const { createNitradoAPI } = require('./nitrado.js');
const { DayZLogAnalyzer } = require('./logAnalyzer.js');
const { routeLogEvent } = require('./logRouter.js');

// ─────────────────────────────────────────────
// ⚙️ Log Monitoring Manager
// ─────────────────────────────────────────────
class LogMonitoringManager {
  constructor() {
    this.activeMonitors = new Map(); // guildId → intervalId
    this.analyzer = new DayZLogAnalyzer();
  }

  // 🧭 Start log monitoring for a specific guild
  async startMonitoring(guildId, client) {
    try {
      const pool = await getPool();

      const { rows } = await pool.query(
        `SELECT service_id, encrypted_token, token_iv, auth_tag
         FROM nitrado_credentials
         WHERE guild_id = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [guildId]
      );

      if (rows.length === 0) {
        logger.warn(`⚠️ No Nitrado credentials for guild ${guildId}. Skipping monitor.`);
        return;
      }

      const creds = rows[0];
      const { decrypt } = require('../utils/encryption.js');
      const token = decrypt(creds.encrypted_token, creds.token_iv, creds.auth_tag);
      const api = createNitradoAPI(token);

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        logger.warn(`⚠️ Guild ${guildId} not found in client cache.`);
        return;
      }

      // Prevent duplicate monitors
      if (this.activeMonitors.has(guildId)) {
        logger.info(`♻️ Restarting log monitor for guild ${guild.name}`);
        clearInterval(this.activeMonitors.get(guildId));
      }

      // Poll logs every 90 seconds
      const interval = setInterval(async () => {
        try {
          const { path: gamePath, files } = await api.findDayzPath(creds.service_id);
          if (!files || files.length === 0) return;

          // pick latest RPT
          const latest = files
            .filter(f => {
              const n = f.name || f.filename || '';
              return n.endsWith('.RPT');
            })
            .sort((a, b) => (b.modified_at || 0) - (a.modified_at || 0))[0];

          if (!latest) return;

          const fileName = latest.name || latest.filename;
          const filePath = `${gamePath}/${fileName}`;

          const raw = await api.downloadFile(creds.service_id, filePath);
          if (!raw) return;

          const fileBuffer = raw.data || raw; // axios vs direct buffer
          const events = this.analyzer.processLogContent(
            fileBuffer,
            filePath,
            guildId,
            creds.service_id
          );

          if (Array.isArray(events) && events.length > 0) {
            let routedCount = 0;

            for (const evt of events) {
              // Normalize event for logRouter:
              // it accepts a string OR { text, type, meta }
              const input =
                typeof evt === 'string'
                  ? evt
                  : {
                      text: evt.text || evt.message || evt.rawLine || '',
                      type: evt.type || undefined,
                      meta: evt.meta || {},
                    };

              if (!input.text || !input.text.trim()) continue;

              const ok = await routeLogEvent(input, guild, client);
              if (ok) routedCount++;
            }

            logger.info(
              `📡 Processed ${events.length} log events for ${guild.name} (routed ${routedCount}).`
            );
          }
        } catch (err) {
          logger.warn(`⚠️ Log polling error for guild ${guildId}: ${err.message}`);
        }
      }, 90_000);

      this.activeMonitors.set(guildId, interval);
      logger.info(`📂 Log monitoring started for guild ${guild.name}`);
    } catch (err) {
      logger.error(`❌ Failed to start monitoring for ${guildId}: ${err.message}`);
    }
  }

  // 🧹 Stop monitoring one guild
  stopMonitoring(guildId) {
    if (this.activeMonitors.has(guildId)) {
      clearInterval(this.activeMonitors.get(guildId));
      this.activeMonitors.delete(guildId);
      logger.info(`🛑 Log monitoring stopped for guild ${guildId}`);
    }
  }

  // 🧹 Stop all monitors (for shutdown / reload)
  stopAll() {
    for (const [guildId, interval] of this.activeMonitors.entries()) {
      clearInterval(interval);
      logger.info(`🛑 Log monitoring stopped for guild ${guildId}`);
    }
    this.activeMonitors.clear();
  }
}

module.exports = {
  logMonitoringManager: new LogMonitoringManager(),
  LogMonitoringManager
};

