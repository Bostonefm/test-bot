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

/* ========================================================================
 * 🧩 DayZ Log Analyzer Class — patched with OLD METHOD SUPPORT
 * ======================================================================== */
class DayZLogAnalyzer {
  constructor() {
    this.lastProcessedTimestamps = new Map();
    this.playerSessions = new Map();
    this.serverMetrics = new Map();
  }

  /* -----------------------------
   * OLD API SUPPORT
   * ----------------------------- */
  processLogContent(content, filePath = 'unknown', guildId = null, serviceId = null) {
    if (!content || typeof content !== 'string') return [];

    const lines = content.split('\n').filter(Boolean);
    const events = [];

    for (const line of lines) {
      const parsed = this.parseLogEntry(line, serviceId, filePath);
      if (parsed) {
        parsed.guildId = guildId;
        parsed.serviceId = serviceId;
        parsed.fileName = filePath;
        events.push(parsed);
      }
    }
    return events;
  }

  /* Parse a single entry */
  parseLogEntry(logLine, serviceId, fileName = 'unknown.log') {
    const timestamp = this.extractTimestamp(logLine);
    if (!timestamp) return null;
    const logType = this.getLogFileType(fileName);

    // Custom detections
    if (/\[Logout\]: New player/i.test(logLine)) return { type: 'logout_start', timestamp, serviceId, rawLine: logLine };
    if (/\[Logout\]: Player .*finished/i.test(logLine)) return { type: 'logout_complete', timestamp, serviceId, rawLine: logLine };
    if (/\[Logout\]: Player .*cancelled/i.test(logLine)) return { type: 'logout_cancel', timestamp, serviceId, rawLine: logLine };
    if (/InvokeOnConnect/i.test(logLine)) return { type: 'player_connect_init', timestamp, serviceId, rawLine: logLine };
    if (/InvokeOnDisconnect/i.test(logLine)) return { type: 'player_disconnect_init', timestamp, serviceId, rawLine: logLine };
    if (/ClientRespawnEvent/i.test(logLine)) return { type: 'player_respawn', timestamp, serviceId, rawLine: logLine };

    // fallback pattern match
    const signatureMatch = detectDayZLogCategory(logLine);
    if (signatureMatch) {
      return {
        type: signatureMatch.category,
        timestamp,
        serviceId,
        rawLine: logLine.trim(),
        matchedPattern: signatureMatch.matched.toString(),
      };
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
    return 'unknown';
  }
}

module.exports = {
  DayZLogAnalyzer,
  detectDayZLogCategory,
  DAYZ_PATTERNS
};
