// events/guildFeedSync.js
const db = require('../modules/db');
const logger = require('../config/logger');
const feedMap = require('../config/feedMap.config.json');

/**
 * Sync default feeds into guild_feed_settings for a specific guild.
 * Adds any missing feeds without overwriting custom ones.
 */
async function syncGuildFeeds(guildId, guildName = 'Unknown Guild') {
  try {
    const feeds = feedMap.default;
    let inserted = 0;

    for (const [feedName, config] of Object.entries(feeds)) {
      const res = await db.query(
        'SELECT 1 FROM guild_feed_settings WHERE guild_id=$1 AND feed_name=$2 LIMIT 1',
        [guildId, feedName]
      );
      if (res.rowCount === 0) {
        await db.query(
          `INSERT INTO guild_feed_settings (guild_id, feed_name, visibility, show_location)
           VALUES ($1,$2,$3,$4)`,
          [guildId, feedName, config.visibility || 'public', config.showLocation ?? true]
        );
        inserted++;
      }
    }

    if (inserted > 0) {
      logger.info(`🧩 Initialized ${inserted} feeds for guild: ${guildName}`);
    } else {
      logger.info(`✅ Feed settings already synced for guild: ${guildName}`);
    }
    return inserted;
  } catch (error) {
    logger.error(`❌ Feed sync failed for ${guildName}: ${error.message}`);
    return 0;
  }
}

module.exports = (client) => {
  client.on('guildCreate', async (guild) => {
    logger.info(`🆕 Bot joined new guild: ${guild.name}`);
    await syncGuildFeeds(guild.id, guild.name);
  });
};

module.exports.syncGuildFeeds = syncGuildFeeds;
