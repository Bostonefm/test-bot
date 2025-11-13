// modules/logRouter.js
const { EmbedBuilder } = require("discord.js");
const feedMapDefault = require("../config/feedMap.config.json");
const { db } = require("./db.js");
const logger = require("../config/logger.js");

/**
 * Load feed mapping for a guild.
 * Tries database override first; falls back to default config if none found.
 */
async function getFeedMapForGuild(guildId) {
  try {
    const res = await db.query(
      "SELECT feed_map FROM guild_feed_map WHERE guild_id = $1",
      [guildId]
    );
    if (res.rows.length > 0) {
      logger.debug(`Loaded custom feed map for guild ${guildId}`);
      return res.rows[0].feed_map;
    }
  } catch (err) {
    logger.error(`Error loading custom feed map for guild ${guildId}: ${err.message}`);
  }
  return feedMapDefault.default;
}

/**
 * Routes a single Nitrado log line to the appropriate Discord channel(s).
 */
async function routeLogLine(client, guild, line) {
  try {
    const feedMap = await getFeedMapForGuild(guild.id);
    const lower = line.toLowerCase();

    for (const [feedName, feedConfig] of Object.entries(feedMap)) {
      if (feedConfig.patterns?.some(p => lower.includes(p.toLowerCase()))) {
        const targetChannel = guild.channels.cache.find(
          c => c.name === feedConfig.channel
        );
        if (!targetChannel) return;

        const embed = new EmbedBuilder()
          .setColor(feedConfig.color || "#888888")
          .setTitle(`${feedConfig.emoji || "📜"} ${feedName.toUpperCase()}`)
          .setDescription("```" + line.trim() + "```")
          .setFooter({ text: `Source: ${guild.name} | Nitrado Log Feed` })
          .setTimestamp();

        await targetChannel.send({ embeds: [embed] });
        logger.debug(`[ROUTER] ${guild.name}: sent "${feedName}" log to #${feedConfig.channel}`);
        return; // stop after first match
      }
    }
  } catch (err) {
    logger.error(`[ROUTER ERROR] ${err.message}`);
  }
}

module.exports = { routeLogLine };
