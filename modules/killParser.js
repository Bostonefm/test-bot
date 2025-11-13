
const logger = require('../utils/logger.js');

/**
 * Parses raw DayZ PS4 kill-feed log content for kill events.
 * @param {string} content - The raw file content of .ADM or .RPT logs
 * @returns {Array<Object>} Array of kill event objects
 */
function parseKillFeed(content) {
  const lines = content.split(/\r?\n/);
  const kills = [];

  // Enhanced regex patterns for different DayZ log formats
  const patterns = [
    // Standard format: [HH:MM:SS] "KillerName" kills "VictimName" with "WeaponName" at x,y,z
    /^\[(\d{2}:\d{2}:\d{2})\] \"(.+?)\" kills \"(.+?)\" with \"(.+?)\" at ([\d\.]+),([\d\.]+),([\d\.]+)/,

    // Alternative format without quotes
    /^\[(\d{2}:\d{2}:\d{2})\] (\w+) kills (\w+) with (.+?) at ([\d\.]+),([\d\.]+),([\d\.]+)/,

    // Console format with timestamps
    /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\"(.+?)\" kills \"(.+?)\" with \"(.+?)\" at ([\d\.]+),([\d\.]+),([\d\.]+)/,

    // Simple kill format
    /Kill:\s*\"(.+?)\" killed \"(.+?)\" with \"(.+?)\"/i,
  ];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    for (const pattern of patterns) {
      const match = pattern.exec(trimmedLine);
      if (match) {
        let killEvent;

        if (match.length === 8) {
          // Full format with coordinates
          const [, time, killer, victim, weapon, x, y, z] = match;
          killEvent = {
            timestamp: time,
            killer: killer.trim(),
            victim: victim.trim(),
            weapon: weapon.trim(),
            location: {
              x: parseFloat(x),
              y: parseFloat(y),
              z: parseFloat(z) || 0,
            },
            rawLine: trimmedLine,
            eventType: 'kill',
          };
        } else if (match.length === 7) {
          // Format without z coordinate
          const [, time, killer, victim, weapon, x, y] = match;
          killEvent = {
            timestamp: time,
            killer: killer.trim(),
            victim: victim.trim(),
            weapon: weapon.trim(),
            location: {
              x: parseFloat(x),
              y: parseFloat(y),
              z: 0,
            },
            rawLine: trimmedLine,
            eventType: 'kill',
          };
        } else if (match.length === 4) {
          // Simple kill format without coordinates
          const [, killer, victim, weapon] = match;
          killEvent = {
            timestamp: new Date().toISOString(),
            killer: killer.trim(),
            victim: victim.trim(),
            weapon: weapon.trim(),
            location: { x: 0, y: 0, z: 0 },
            rawLine: trimmedLine,
            eventType: 'kill',
          };
        }

        if (killEvent) {
          // Add additional metadata
          killEvent.guildId = null; // Will be set by caller
          killEvent.serviceId = null; // Will be set by caller
          killEvent.channelId = null; // Will be set by caller
          killEvent.parsedAt = new Date().toISOString();

          kills.push(killEvent);
          logger.debug(
            `📝 Parsed kill event: ${killEvent.killer} -> ${killEvent.victim} with ${killEvent.weapon}`
          );
          break; // Found a match, no need to try other patterns
        }
      }
    }
  }

  if (kills.length > 0) {
    logger.info(`🎯 Parsed ${kills.length} kill events from log content`);
  }

  return kills;
}

/**
 * Parse general log events (including kills and other events)
 * @param {string} content - Raw log content
 * @returns {Array<Object>} Array of all parsed events
 */
function parseLogEvents(content) {
  const events = [];

  // Get kill events
  const killEvents = parseKillFeed(content);
  events.push(...killEvents);

  // Parse other event types
  const otherEvents = parseOtherEvents(content);
  events.push(...otherEvents);

  return events;
}

/**
 * Parse other DayZ events (player joins, leaves, etc.)
 * @param {string} content - Raw log content
 * @returns {Array<Object>} Array of other event objects
 */
function parseOtherEvents(content) {
  const lines = content.split(/\r?\n/);
  const events = [];

  const patterns = [
    // Player connected
    {
      pattern: /Player \"(.+?)\" connected/i,
      type: 'player_connect',
      extract: match => ({ player: match[1] }),
    },

    // Player disconnected
    {
      pattern: /Player \"(.+?)\" disconnected/i,
      type: 'player_disconnect',
      extract: match => ({ player: match[1] }),
    },

    // Player died
    {
      pattern: /Player \"(.+?)\" died/i,
      type: 'player_death',
      extract: match => ({ player: match[1] }),
    },

    // Admin actions
    {
      pattern: /Admin \"(.+?)\" (.+)/i,
      type: 'admin_action',
      extract: match => ({ admin: match[1], action: match[2] }),
    },
  ];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    for (const { pattern, type, extract } of patterns) {
      const match = pattern.exec(trimmedLine);
      if (match) {
        const eventData = extract(match);
        const event = {
          timestamp: new Date().toISOString(),
          eventType: type,
          rawLine: trimmedLine,
          parsedAt: new Date().toISOString(),
          ...eventData,
        };

        events.push(event);
        logger.debug(`📝 Parsed ${type} event: ${JSON.stringify(eventData)}`);
        break;
      }
    }
  }

  return events;
}

/**
 * Format location coordinates for display
 * @param {Object} location - Location object with x, y, z coordinates
 * @returns {string} Formatted location string
 */
function formatLocation(location) {
  if (!location || typeof location !== 'object') {
    return 'Unknown';
  }

  const { x, y, z } = location;
  if (x === 0 && y === 0) {
    return 'Unknown';
  }

  return `(${Math.round(x)}, ${Math.round(y)})`;
}

module.exports = {
  parse: parseKillFeed,
  parseKillFeed,
  parseLogEvents,
  parseOtherEvents,
  formatLocation,
};
