// modules/configValidator.js
const fs = require("fs");
const path = require("path");
const { ChannelType } = require("discord.js");
const logger = require("../config/logger.js");

/**
 * Validates and auto-repairs a guild’s structure.
 * @param {Guild} guild  The Discord guild to validate.
 * @param {"central"|"subscriber"|"assistant"} configType
 */
async function validateConfig(guild, configType = "subscriber") {
  try {
    const configPath = path.join(__dirname, `../config/${configType}.config.json`);
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    logger.info(`🧩 Validating ${configType} configuration for guild ${guild.name}`);

    // === 1️⃣  ROLES ===
    const missingRoles = [];
    for (const roleName of configData.requiredRoles || []) {
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (!role) {
        await guild.roles.create({ name: roleName, reason: "Auto-repair missing role" });
        missingRoles.push(roleName);
      }
    }
    if (missingRoles.length)
      logger.warn(`Created missing roles in ${guild.name}: ${missingRoles.join(", ")}`);

    // === 2️⃣  CATEGORIES & CHANNELS ===
    for (const category of configData.categories || []) {
      // Ensure category exists
      let parent = guild.channels.cache.find(
        c => c.name === category.name && c.type === ChannelType.GuildCategory
      );
      if (!parent) {
        parent = await guild.channels.create({
          name: category.name,
          type: ChannelType.GuildCategory,
          reason: "Auto-repair missing category",
        });
        logger.warn(`Created missing category: ${category.name}`);
      }

      // Ensure channels exist
      for (const chName of category.channels) {
        let ch = guild.channels.cache.find(
          c => c.name === chName && c.parentId === parent.id
        );
        if (!ch) {
          ch = await guild.channels.create({
            name: chName,
            type: ChannelType.GuildText,
            parent: parent.id,
            reason: "Auto-repair missing channel",
          });
          logger.warn(`Created missing channel: ${chName}`);
        }

        // Optional: add starter message if channel empty
        const starter = configData.starterMessages?.[chName];
        if (starter) {
          const recent = await ch.messages.fetch({ limit: 5 });
          if (!recent.some(m => m.author.bot && m.content.includes(starter.slice(0, 10)))) {
            await ch.send(starter);
            logger.info(`Re-seeded starter message in #${chName}`);
          }
        }
      }
    }

    logger.info(`✅ Validation finished for ${guild.name}`);
    return true;
  } catch (err) {
    logger.error(`❌ Validation failed for ${guild.name}: ${err.message}`, err);
    return false;
  }
}

module.exports = { validateConfig };
