const { ActivityType } = require('discord.js');
const { bootstrapGuild } = require('../modules/bootstrapGuild.js');
const { validateConfig } = require('../modules/configValidator.js');
const { SatelliteUpdater } = require('../modules/satelliteUpdater.js');
const NitradoPollingMonitor = require('../modules/nitradoPollingMonitor.js');
const TokenAutoRefresh = require('../modules/tokenAutoRefresh.js');
const TierManager = require('../modules/tierManager.js');
const GuildPrivacyManager = require('../modules/guildPrivacy.js');
const { db, getPool } = require('../modules/db.js');
const logger = require('../config/logger.js');
const { syncAllPermissions } = require('../utils/permissionSync.js');

module.exports = (client) => {
  client.once('ready', async () => {

    // =====================================================
    // 1) Presence
    // =====================================================
    setPresence(client);

    // =====================================================
    // 2) Restore OLD Log Monitoring Manager (from your old bot)
    // =====================================================
    logger.info("🔧 Restoring legacy Log Monitoring Manager...");

    try {
      const { logMonitoringManager } = require('../modules/logMonitoringManager.js');
      const pool = await getPool();

      const q = await pool.query(`
        SELECT guild_id FROM nitrado_credentials
        WHERE service_id IS NOT NULL
      `);

      if (!q.rows.length) {
        logger.warn("⚠️ No guilds found with Nitrado credentials — skipping log monitor autostart.");
      } else {
        for (const row of q.rows) {
          const guildId = row.guild_id;
          const guild = client.guilds.cache.get(guildId);

          if (!guild) {
            logger.warn(`⚠️ Guild ${guildId} is not in cache — skipping.`);
            continue;
          }

          logger.info(`📡 Auto-starting legacy log monitoring for guild ${guild.name}`);
          await logMonitoringManager.startMonitoring(guildId, client);
        }

        logger.info("✅ Legacy Log Monitoring Manager fully initialized");
      }
    } catch (err) {
      logger.error("❌ Failed to restore legacy Log Monitoring Manager:", err);
    }

    // =====================================================
    // 3) Nitrado Polling Monitor (new bot system)
    // =====================================================
    try {
      client.nitradoPollingMonitor = new NitradoPollingMonitor(client);
      logger.info("Nitrado Polling Monitor initialized successfully.");

      const { decrypt } = require('../utils/encryption.js');

      for (const [guildId, guild] of client.guilds.cache) {
        const nitradoCreds = await db.getNitradoCredsByGuild(guildId);

        if (nitradoCreds?.encrypted_token && nitradoCreds?.service_id) {
          const token = decrypt(
            nitradoCreds.encrypted_token,
            nitradoCreds.token_iv,
            nitradoCreds.auth_tag
          );

          await client.nitradoPollingMonitor.startMonitoring(
            nitradoCreds.service_id,
            token,
            guildId
          );

          logger.info(
            `✅ Auto-started Nitrado polling for ${guild.name} (service: ${nitradoCreds.service_id})`
          );
        }
      }
    } catch (error) {
      logger.error("❌ Failed to start Nitrado Polling Monitor:", error);
    }

    // =====================================================
    // 4) Nitrado Resource + Notifications + Token refresh
    // =====================================================

    try {
      client.tokenAutoRefresh = new TokenAutoRefresh();
      await client.tokenAutoRefresh.start();
      logger.info('✅ Token auto-refresh service started successfully');
    } catch (err) {
      logger.error('❌ Failed to initialize token auto-refresh:', err);
    }

    try {
      const NitradoNotificationsMonitor = require('../modules/nitradoNotifications.js');
      client.nitradoNotifications = new NitradoNotificationsMonitor(client);
      await client.nitradoNotifications.start();
      logger.info('✅ Nitrado notifications monitor started successfully');
    } catch (err) {
      logger.error('❌ Failed to initialize notifications monitor:', err);
    }

    try {
      const NitradoResourceMonitor = require('../modules/nitradoResourceMonitor.js');
      client.nitradoResources = new NitradoResourceMonitor(client);
      await client.nitradoResources.start();
      logger.info('✅ Nitrado resource monitor started successfully');
    } catch (err) {
      logger.error('❌ Failed to initialize resource monitor:', err);
    }

    // =====================================================
    // 5) Tier, Privacy, Scheduler
    // =====================================================
    const poolInstance = await getPool();
    client.tierManager = new TierManager(poolInstance, logger);
    client.guildPrivacy = new GuildPrivacyManager(poolInstance);

    try {
      const { initializeScheduler } = require('../services/scheduler.js');
      initializeScheduler();
      logger.info('✅ Scheduled cleanup tasks initialized');
    } catch (err) {
      logger.error('❌ Failed to initialize scheduler:', err);
    }

    // =====================================================
    // 6) Sync permissions after startup
    // =====================================================
    setTimeout(async () => {
      logger.info("🔐 Starting permission sync...");
      const syncResults = await syncAllPermissions(client);
      const totalSynced = syncResults.reduce((sum, r) => sum + (r.synced || 0), 0);
      logger.info(`🔐 Permission sync complete: ${totalSynced} channels updated across ${syncResults.length} guilds`);
    }, 5000);

    // =====================================================
    // 7) Diagnostics
    // =====================================================
    await runDiagnostics(client);

  });
};


// ==========================
// Helpers
// ==========================
function setPresence(client) {
  const defaultStatus = 'Grizzly Network | /help';
  const gccGuildId = process.env.GRIZZLY_COMMAND_GUILD_ID;
  const guilds = client.guilds.cache;
  let activityText = defaultStatus;

  if (guilds.size > 0) {
    const guildNames = guilds.map(g => g.name);
    const isInGCC = guilds.has(gccGuildId);

    if (isInGCC && guilds.size === 1) activityText = 'Grizzly Command Central';
    else if (guilds.size === 1) activityText = `${guildNames[0]} | /help`;
    else if (isInGCC) activityText = `GCC + ${guilds.size - 1} Servers`;
    else activityText = `${guilds.size} DayZ Servers | /help`;
  }

  client.user.setPresence({
    activities: [{ name: activityText, type: ActivityType.Watching }],
    status: 'online',
  });

  logger.info(`Presence set: Watching "${activityText}"`);
}

async function runDiagnostics(client) {
  try {
    const diagnostics = [];
    const discordStatus = client.ws.status === 0 ? '✅' : '❌';
    diagnostics.push(`${discordStatus} Discord Connected`);

    const start = Date.now();
    await db.query('SELECT 1');
    const latency = Date.now() - start;
    diagnostics.push(`✅ Database Connected (${latency} ms)`);

    diagnostics.push('🟢 System Ready – All critical modules checked.');
    logger.info('Startup diagnostics completed successfully.');
  } catch (error) {
    logger.error('Startup diagnostics failed:', error);
  }
}
