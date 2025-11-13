const logger = require("../config/logger.js");
const { db } = require("./db.js");

/**
 * Handles new member joins by sending a customizable welcome message.
 * Supports placeholders:
 *   {user}  → mentions the user
 *   {rules} → links the "rules" channel if it exists
 *   {server} → inserts the guild name
 */
async function handleMemberJoin(member) {
  try {
    // Find the welcome channel (configurable name)
    const welcomeChannel = member.guild.channels.cache.find(
      ch => ch.name === "welcome-message" && ch.isTextBased()
    );

    if (!welcomeChannel) {
      logger.warn(`⚠️ No #welcome-message channel found in ${member.guild.name}`);
      return;
    }

    // Try to fetch custom message from database
    let welcomeMessage = null;
    try {
      const result = await db.query(
        "SELECT welcome_message FROM guild_settings WHERE guild_id = $1",
        [member.guild.id]
      );
      if (result.rows.length > 0 && result.rows[0].welcome_message) {
        welcomeMessage = result.rows[0].welcome_message;
      }
    } catch (error) {
      logger.warn(`⚠️ Could not load custom welcome message for ${member.guild.name}: ${error.message}`);
    }

    // Default fallback message if none found
    if (!welcomeMessage) {
      welcomeMessage =
        "{user}, Welcome to **{server}**! 🌅\nSurvivor, your journey begins here.\nVisit ➜ {rules} and agree to the rules to gain full access to the community.";
    }

    // Replace placeholders
    const rulesChannel = member.guild.channels.cache.find(c => c.name === "rules");
    welcomeMessage = welcomeMessage
      .replace(/\{user\}/g, member.toString())
      .replace(/\{server\}/g, member.guild.name)
      .replace(/\{rules\}/g, rulesChannel ? `<#${rulesChannel.id}>` : "#rules");

    // Send message
    await welcomeChannel.send(welcomeMessage);
    logger.info(`✅ Sent welcome message for ${member.user.tag} in ${member.guild.name}`);
  } catch (error) {
    logger.error(`❌ Failed to send welcome message in ${member.guild.name}:`, error);
  }
}

/**
 * Command utility to allow admins to update their welcome message dynamically
 * Example usage: /setwelcome "Welcome {user} to {server}! Read {rules}."
 */
async function setCustomWelcomeMessage(guildId, message) {
  try {
    await db.query(
      `
      INSERT INTO guild_settings (guild_id, welcome_message)
      VALUES ($1, $2)
      ON CONFLICT (guild_id)
      DO UPDATE SET welcome_message = EXCLUDED.welcome_message;
    `,
      [guildId, message]
    );

    logger.info(`✅ Updated custom welcome message for guild ${guildId}`);
  } catch (error) {
    logger.error(`❌ Failed to update custom welcome message: ${error.message}`);
    throw error;
  }
}

module.exports = {
  handleMemberJoin,
  setCustomWelcomeMessage,
};
