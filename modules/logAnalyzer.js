const logger = require('../config/logger.js');
const { createNitradoAPI } = require('./nitrado');

/* ========================================================================
 * 🧭 DayZ Log Signature Dictionary (Cross-Compatible: PC / PS4 / Xbox)
 * ======================================================================== */
const DAYZ_PATTERNS = {
  connection: [/\bconnected\b/i, /\bhas connected\b/i, /\bjoined the game\b/i, /\bconnected from\b/i],
  disconnection: [/\bdisconnected\b/i, /\bhas left the game\b/i, /\bconnection lost\b/i, /\bplayer dropped\b/i],
  kill: [/\bkilled\b/i, /\bhas been killed by\b/i, /\bdied from\b/i, /\bshot by\b/i, /\bwas murdered\b/i],
  death: [/\bdied\b/i, /\bdead\b/i, /\bsuicide\b/i, /\bperished\b/i],
  base_building: [/\bconstructed\b/i, /\bplaced\b/i, /\bbuilt\b/i, /\bdismantled\b/i, /\bdestroyed\b/i, /\battached\b/i, /\brepaired\b/i],
  raid: [/\bdestroyed wall\b/i, /\bblew up\b/i, /\braid\b/i, /\bbreached\b/i],
  dynamic_event: [/Static(AirplaneCrate|BoatFishing|BoatMilitary|Bonfire|ChristmasTree|ContainerLocked|HeliCrash|MilitaryConvoy|PoliceSituation|Train)/i, /\bCentral Economy\b/i, /\bCE\b.*(spawn|cleanup|create)/i],
  economy: [/\bspawned\b/i, /\brespawned\b/i, /\bcleanup\b/i, /\bdespawned\b/i, /\bCentral Economy\b/i],
  vehicle: [/\bvehicle\b.*(spawned|created|deleted|destroyed|cleanup)/i, /\bcar\b.*(spawned|destroyed|exploded)/i, /\boffroad\b/i],
  admin_action: [/Admin "([^"]+)" (kicked|banned|teleported|spawned)/i, /\badmin\b.*(command|restart|ban|kick)/i],
  broadcast: [/Broadcast/i, /\bserver restart\b/i, /\bserver will restart\b/i, /\brestart in\b/i, /\bmaintenance\b/i],
  connection_issue: [/\btimeout\b/i, /\bdropped\b/i, /\bconnection lost\b/i, /\bping timeout\b/i],
  protector_case: [/SmallProtectorCase/i, /protector_case/i],
  player_position: [/\bposition:\s*\(/i, /\bcoords?\s*[:=]\s*\(/i],
  misc: [/LogManager/i, /PluginMessageManager/i, /PlayerBase/i, /Weight/i, /GUI/i, /Unknown/i],
};

function detectDayZLogCategory(line) {
  for (const [category, patterns] of Object.entries(DAYZ_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(line)) return { category, matched: pattern };
    }
  }
  return null;
}

function logSignatureSummary(events = []) {
  const summary = {};
  for (const e of events) {
    const type = e.type || 'unknown';
    summary[type] = (summary[type] || 0) + 1;
  }
  logger.info(`📊 Log Summary: ${Object.entries(summary).map(([t, c]) => `${t}:${c}`).join(', ')}`);
  return summary;
}

function getLatestTimestamp(events) {
  if (!events?.length) return null;
  const ts = events.map(e => e.timestamp).filter(Boolean).sort((a, b) => new Date(b) - new Date(a));
  return ts[0] || null;
}

function parseLogContent(content, options = {}) {
  if (!content || typeof content !== 'string') return [];
  const lines = content.split('\n').filter(l => l.trim());
  return lines.map(line => ({
    timestamp: (line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/) || [])[1] || new Date().toISOString(),
    type: 'log_entry',
    content: line.trim(),
    filePath: options.filePath || 'unknown',
    fileName: options.fileName || 'unknown',
    guildId: options.guildId,
    serviceId: options.serviceId,
  }));
}

/* ========================================================================
 * 🧩 DayZ Log Analyzer Class
 * ======================================================================== */
class DayZLogAnalyzer {
  constructor() {
    this.lastProcessedTimestamps = new Map();
    this.playerSessions = new Map();
    this.serverMetrics = new Map();
  }

  parseLogEntry(logLine, serviceId, fileName = 'unknown.log') {
    const timestamp = this.extractTimestamp(logLine);
    if (!timestamp) return null;
    const logType = this.getLogFileType(fileName);

    // --- custom detections (logout, connect, respawn, artillery, etc.) ---
    if (/\[Logout\]: New player/i.test(logLine)) return { type: 'logout_start', timestamp, serviceId, rawLine: logLine };
    if (/\[Logout\]: Player .*finished/i.test(logLine)) return { type: 'logout_complete', timestamp, serviceId, rawLine: logLine };
    if (/\[Logout\]: Player .*cancelled/i.test(logLine)) return { type: 'logout_cancel', timestamp, serviceId, rawLine: logLine };
    if (/InvokeOnConnect/i.test(logLine)) return { type: 'player_connect_init', timestamp, serviceId, rawLine: logLine };
    if (/InvokeOnDisconnect/i.test(logLine)) return { type: 'player_disconnect_init', timestamp, serviceId, rawLine: logLine };
    if (/ClientRespawnEvent/i.test(logLine)) return { type: 'player_respawn', timestamp, serviceId, rawLine: logLine };
    if (/CorpseData|UpdateCorpseState/i.test(logLine)) return { type: 'corpse_update', timestamp, serviceId, rawLine: logLine };

    if (/RPC_SOUND_ARTILLERY/i.test(logLine)) {
      const coords = logLine.match(/<([\d\.\-]+),\s*([\d\.\-]+),\s*([\d\.\-]+)>/);
      return {
        type: 'artillery_event',
        timestamp,
        serviceId,
        coords: coords ? { x: +coords[1], y: +coords[2], z: +coords[3] } : null,
        rawLine: logLine,
      };
    }

    const diag = logLine.match(/DiagMenu:\s*(?<id>[A-Z_]+)\s*=\s*(?<value>\d+)/i);
    if (diag) {
      return {
        type: 'diag_toggle',
        timestamp,
        serviceId,
        id: diag.groups.id,
        value: diag.groups.value === '1',
        category: diag.groups.id.split('_')[0],
        rawLine: logLine,
      };
    }

    // --- fallback detection ---
    const signatureMatch = detectDayZLogCategory(logLine);
    if (signatureMatch) {
      const event = {
        type: signatureMatch.category,
        timestamp,
        serviceId,
        rawLine: logLine.trim(),
        matchedPattern: signatureMatch.matched.toString(),
      };

      const weapon = (logLine.match(/by\s+([A-Za-z0-9_]+)/i) || [])[1];
      const distance = (logLine.match(/distance\s*[:=]?\s*(\d+(\.\d+)?)\s*m/i) || [])[1];
      const hitZone = (logLine.match(/hit\s+(head|torso|legs|arms|chest|stomach)/i) || [])[1];
      if (weapon) event.weapon = weapon;
      if (distance) event.distance = parseFloat(distance);
      if (hitZone) event.hitZone = hitZone;

      const posMatch = logLine.match(/(?:pos|at)[=<\s]*([\d.-]+)[,\s]+([\d.-]+)[,\s]+([\d.-]+)/i);
      if (posMatch) {
        event.position = {
          x: parseFloat(posMatch[1]),
          y: parseFloat(posMatch[2]),
          z: parseFloat(posMatch[3]),
        };
      }
      return event;
    }

    return null;
  }

  extractTimestamp(line) {
    const m = line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/);
    return m ? new Date(m[1]) : new Date();
  }

  getLogFileType(name = '') {
    if (/\.rpt$/i.test(name)) return 'rpt';
    if (/\.adm$/i.test(name)) return 'adm';
    if (/\.log$/i.test(name)) return 'log';
    if (/\.txt$/i.test(name)) return 'txt';
    if (/\.out$/i.test(name)) return 'out';
    if (/\.err$/i.test(name)) return 'err';
    if (/restart/i.test(name)) return 'restart';
    return 'unknown';
  }

  /* ========================================================================
   * 🧮 Fetch recent logs + Generate Summary
   * ======================================================================== */
  async fetchRecentLogs(serviceId, limit = 10) {
    try {
      const nitrado = await createNitradoAPI(serviceId);
      const { data } = await nitrado.get(`/services/${serviceId}/gameservers/files_list?path=dayzxb/config`);
      const logFiles = data?.data?.entries?.filter(f => f.name.match(/\.(RPT|ADM|log)$/i)) || [];

      const latestFiles = logFiles
        .sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified))
        .slice(0, limit);

      const logs = [];
      for (const file of latestFiles) {
        const fileRes = await nitrado.get(`/services/${serviceId}/gameservers/file?file=${encodeURIComponent(file.path)}`);
        logs.push(...(fileRes?.data?.data?.content?.split('\n') || []));
      }

      logger.info(`📄 Pulled ${logs.length} log lines from ${latestFiles.length} file(s)`);
      return logs;
    } catch (err) {
      logger.warn(`⚠️ Failed to fetch logs for service ${serviceId}: ${err.message}`);
      return [];
    }
  }

  async generateSummary(serviceId) {
    try {
      const logs = await this.fetchRecentLogs(serviceId);
      const events = [];

      for (const line of logs) {
        const parsed = this.parseLogEntry(line, serviceId);
        if (parsed) events.push(parsed);
      }

      const summary = events.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {});

      logger.info(`📊 Summary generated for ${serviceId}: ${Object.keys(summary).length} event types`);
      return {
        kills: summary.kill || 0,
        deaths: summary.death || 0,
        connections: summary.connection || 0,
        disconnects: summary.disconnection || 0,
        economy: summary.economy || 0,
        base: summary.base_building || 0,
      };
    } catch (err) {
      logger.error(`❌ Failed to generate summary: ${err.message}`);
      return {};
    }
  }
}

module.exports = {
  parseLogContent,
  getLatestTimestamp,
  DayZLogAnalyzer,
  DAYZ_PATTERNS,
  detectDayZLogCategory,
  logSignatureSummary,
};
