/**
 * Safe defer reply that suppresses Discord.js race condition errors (code 10062)
 * This error occurs when the interaction is already acknowledged but the promise rejects
 * The actual reply succeeds, so we can safely ignore this error
 */
async function safeDeferReply(interaction, options = {}) {
  console.log('[safeDeferReply] Starting defer with options:', options);
  try {
    await interaction.deferReply(options);
    console.log('[safeDeferReply] SUCCESS - interaction.deferred:', interaction.deferred);
  } catch (error) {
    console.log('[safeDeferReply] ERROR caught:', error.code, error.message);
    console.log('[safeDeferReply] interaction.deferred after error:', interaction.deferred);
    // Ignore "Unknown interaction" error (code 10062) - this is a Discord.js race condition
    // The defer actually succeeds, but the promise rejects
    if (error.code === 10062) {
      console.log('[safeDeferReply] Ignoring 10062 error');
      return;
    }
    // Re-throw any other errors
    console.log('[safeDeferReply] Re-throwing error');
    throw error;
  }
}

/**
 * Safe edit reply that suppresses Discord.js race condition errors
 */
async function safeEditReply(interaction, content) {
  try {
    await interaction.editReply(content);
  } catch (error) {
    if (error.code === 10062) {
      return;
    }
    throw error;
  }
}

/**
 * Safe reply that suppresses Discord.js race condition errors
 */
async function safeReply(interaction, content) {
  try {
    await interaction.reply(content);
  } catch (error) {
    if (error.code === 10062) {
      return;
    }
    throw error;
  }
}

module.exports = {
  safeDeferReply,
  safeEditReply,
  safeReply
};
