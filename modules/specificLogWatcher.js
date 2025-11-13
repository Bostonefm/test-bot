'use strict';

// Grizzly Bot — Specific Log Watcher (safe on startup)
// Path: modules/specificLogWatcher.js

const logger = require('../config/logger.js');

let optionalManager = null;
try {
  // Optional – used if present. Must NOT throw if missing.
  optionalManager = require('./logMonitoringManager.js');
} catch (_) {
  // intentionally empty – we can still run in “external reader” mode
}

/**
 * In-memory registry of active watchers.
 * key: watcherId -> { timer, options }
 */
const watchers = new Map();
let nextId = 1;

/**
 * Start a specific log watcher.
 *
 * options = {
 *   guildId: string,
 *   serviceId: string|number,
 *   channels: { discordChannelId?: string },
 *   paths: string[]               // candidate remote log paths
 *   phrases: string[]             // phrases to match
 *   pollIntervalMs?: number       // default 15s
 *   once?: boolean                // stop after first match
 *   onMatch?: (match) => void     // optional callback
 *   // If optionalManager exists, we use its API to read logs.
 *   // Otherwise you must pass a custom reader on options.readLatest
 *   readLatest?: async ({serviceId, paths, since}) => [{path, lines: string[]}]
 * }
 */
function startSpecificLogWatcher(options) {
  const {
    guildId,
    serviceId,
    channels = {},
    paths = [],
    phrases = [],
    pollIntervalMs = 15_000,
    once = false,
    onMatch,
    readLatest,
  } = options || {};

  if (!serviceId || !Array.isArray(paths) || !Array.isArray(phrases)) {
    throw new Error('startSpecificLogWatcher: missing serviceId, paths, or phrases');
  }
  if (!optionalManager && typeof readLatest !== 'function') {
    throw new Error('startSpecificLogWatcher: no log reader available. Provide options.readLatest or include logMonitoringManager.js');
  }

  const watcherId = String(nextId++);
  let since = Date.now() - 60_000; // start from last minute to avoid spam on first poll
  const phraseRegex = buildPhraseRegex(phrases);

  const tick = async () => {
    try {
      const reader = optionalManager?.readLatestLogs || readLatest;
      const batches = await reader({ serviceId, paths, since });

      let foundAny = false;
      for (const batch of batches || []) {
        for (const line of batch.lines || []) {
          if (phraseRegex.test(line)) {
            foundAny = true;
            const match = {
              guildId,
              serviceId,
              path: batch.path,
              line,
              when: new Date().toISOString(),
              channelId: channels.discordChannelId || null,
            };
            logger.info(`🔎 specificLogWatcher: match @ ${batch.path}`);
            try { onMatch && onMatch(match); } catch (err) {
              logger.warn(`specificLogWatcher onMatch error: ${err.message}`);
            }
          }
        }
      }

      since = Date.now();
      if (once && foundAny) stopSpecificLogWatcher(watcherId);
    } catch (err) {
      logger.warn(`specificLogWatcher poll error: ${err.message}`);
    }
  };

  const timer = setInterval(tick, pollIntervalMs);
  watchers.set(watcherId, { timer, options: { ...options } });

  logger.info(`🛰️ Started specificLogWatcher #${watcherId} (service ${serviceId})`);
  return watcherId;
}

function stopSpecificLogWatcher(watcherId) {
  const rec = watchers.get(String(watcherId));
  if (!rec) return false;
  clearInterval(rec.timer);
  watchers.delete(String(watcherId));
  logger.info(`🛑 Stopped specificLogWatcher #${watcherId}`);
  return true;
}

function listSpecificLogWatchers() {
  return Array.from(watchers.entries()).map(([id, { options }]) => ({
    id,
    serviceId: options.serviceId,
    phrases: options.phrases,
    paths: options.paths,
    pollIntervalMs: options.pollIntervalMs || 15_000,
  }));
}

function buildPhraseRegex(phrases) {
  if (!phrases.length) return /$a/; // matches nothing
  const escaped = phrases.map(p => escapeRegex(p));
  return new RegExp(escaped.join('|'), 'i');
}
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  startSpecificLogWatcher,
  stopSpecificLogWatcher,
  listSpecificLogWatchers,
};
