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

// NEW unified system
const { logMonitoringManager } = require('../modules/logMonitoringManager.js');

module.exports = (client) => {
  client.once('ready', async () => {
    // =====================================================
    // 1) Presence
    // =====================================================
    setPresence(client);

    // =====================================================
    // 2) NEW Unified DayZ Log Monitor
    // =====================================================
    logger.info("🔧 Starting unified DayZ Log Monitoring Manager...");

    try {
      const pool = await getPool();
      const q = await pool.query(`
        SELECT guild_id FROM nitrado_credentials 
        WHERE service_id IS NOT NULL
      `);

      if (!q.rows.length) {
        logger.warn("⚠️ No guilds with Nitrado credentials found — skipping log monitor.");
      } else {
        for (const row of q.rows) {
          const guildId = row.guild_id;
          const guild = client.guilds.cache.get(guildId);

          if (!guild) {
            logger.warn(`⚠️ Guild ${guildId} missing in cache — skipping log monitor.`);
            continue;
          }

          logger.info(`📡 Starting unified log monitoring for guild ${guild.name}...`);
          await logMonitoringManager.startMonitoring(guildId, client);
        }

        logger.info("✅ Unified Log Monitoring Manager fully initialized");
      }
    } catch (err) {
      logger.error("❌ Failed to start unified Log Monitoring Manager:", err);
    }

    // =====================================================
    // 3) Nitrado Polling Monitor (status/cpu/mem/server)
    // =====================================================
    try {
      client.nitradoPollingMonitor = new NitradoPollingMonitor(client);
      logger.info("Nitrado Polling Monitor initialized.");

      const { decrypt } = require('../utils/encryption.js');

      for (const [guildId, guild] of client.guilds.cache) {
        const creds = await db.getNitradoCredsByGuild(guildId);

        if (creds?.encrypted_token && creds?.service_id) {
          const token = decrypt(creds.encrypted_token, creds.token_iv, creds.auth_tag);

          await client.nitradoPollingMonitor.startMonitoring(
            creds.service_id,
            token,
            guildId
          );

          logger.info(`✅ Auto-started Nitrado polling for ${guild.name}`);
        }
      }
    } catch (err) {
      logger.error("❌ Failed to initialize Nitrado polling:", err);
    }

    // =====================================================
    // 4) Token Refresh / Notifications / Resource Monitor
    // =====================================================
    try {
      client.tokenAutoRefresh = new TokenAutoRefresh();
      await client.tokenAutoRefresh.start();
      logger.info('✅ Token auto-refresh running');
    } catch (err) {
      logger.error('❌ Token auto-refresh failed:', err);
    }

    try {
      const NitradoNotificationsMonitor = require('../modules/nitradoNotifications.js');
      client.nitradoNotifications = new NitradoNotificationsMonitor(client);
      await client.nitradoNotifications.start();
      logger.info('✅ Notifications monitor running');
    } catch (err) {
      logger.error('❌ Notifications monitor failed:', err);
    }

    try {
      const NitradoResourceMonitor = require('../modules/nitradoResourceMonitor.js');
      client.nitradoResources = new NitradoResourceMonitor(client);
      await client.nitradoResources.start();
      logger.info('✅ Resource monitor running');
    } catch (err) {
      logger.error('❌ Resource monitor failed:', err);
    }

    // =====================================================
    // 5) Tier Manager / Privacy Manager / Scheduler
    // =====================================================
    const poolInstance = await getPool();
    client.tierManager = new TierManager(poolInstance, logger);
    client.guildPrivacy = new GuildPrivacyManager(poolInstance);

    try {
      const { initializeScheduler } = require('../services/scheduler.js');
      initializeScheduler();
      logger.info("✅ Scheduled cleanup tasks ready");
    } catch (err) {
      logger.error("❌ Scheduler initialization failed:", err);
    }

    // =====================================================
    // 6) Permission Sync
    // =====================================================
    setTimeout(async () => {
      logger.info("🔐 Starting permission sync...");
      const results = await syncAllPermissions(client);

      const totalSynced = results.reduce((a, r) => a + (r.synced || 0), 0);
      logger.info(`🔐 Permissions synced: ${totalSynced} channels across ${results.length} guilds`);
    }, 5000);

    // =====================================================
    // 7) Diagnostics
    // =====================================================
    await runDiagnostics(client);
  });
};

//
// ==========================
// Helpers
// ==========================
function setPresence(client) {
  const defaultStatus = 'Grizzly Network | /help';
  const gccGuildId = process.env.GRIZZLY_COMMAND_GUILD_ID;
  const guilds = client.guilds.cache;
  let activityText = defaultStatus;

  if (guilds.size > 0) {
    const names = guilds.map(g => g.name);
    const isInGCC = guilds.has(gccGuildId);

    if (isInGCC && guilds.size === 1) activityText = 'Grizzly Command Central';
    else if (guilds.size === 1) activityText = `${names[0]} | /help`;
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
    diagnostics.push(`✅ Database Connected (${Date.now() - start} ms)`);

    logger.info("Startup diagnostics completed successfully.");
  } catch (err) {
    logger.error("Startup diagnostics failed:", err);
  }
}
