// /commands/admin-cleanup.js
// ============================================================
// 🧹 Grizzly Bot — Admin Cleanup Command
// Removes stale logs, inactive guild data, and unused DB records.
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getPool } = require('../utils/db.js');
const logger = require('../config/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-cleanup')
    .setDescription('Purge outdated data and clean the database.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const pool = getPool();

    try {
      logger.info('🧹 Starting database cleanup...');
      const results = [];

      // Example cleanups — adjust tables to match your schema
      results.push(await pool.query(`DELETE FROM bot_logs WHERE created_at < NOW() - INTERVAL '30 days';`));
      results.push(await pool.query(`DELETE FROM bot_updates WHERE created_at < NOW() - INTERVAL '60 days';`));
      results.push(await pool.query(`DELETE FROM audit_log WHERE timestamp < NOW() - INTERVAL '90 days';`));

      logger.info(`✅ Cleanup complete — ${results.length} queries executed.`);
      await interaction.editReply(`✅ Cleanup complete — ${results.length} cleanup tasks executed.`);
    } catch (err) {
      logger.error(`❌ Cleanup failed: ${err.message}`);
      await interaction.editReply(`❌ Cleanup failed:\n\`\`\`${err.message}\`\`\``);
    }
  },
};
