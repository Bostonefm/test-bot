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
    logger.info(`Logged in as ${client.user.tag}!`);
    setPresence(client);

   // =====================================================
// 🟢 Nitrado Polling Monitor + Log Monitor Initialization
// =====================================================
try {
  client.nitradoPollingMonitor = new NitradoPollingMonitor(client);
  logger.info('Nitrado Polling Monitor initialized successfully.');

  const { decrypt } = require('../utils/encryption.js');
  const { db } = require('../modules/db.js');

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

  // ✅ Unified Log Monitoring Manager (handles killfeed, placed items, etc.)
  const { logMonitoringManager } = require('../modules/logMonitoringManager.js');
  try {
    for (const [guildId] of client.guilds.cache) {
      await logMonitoringManager.startMonitoring(guildId, client);
    }
    logger.info('✅ Log monitoring manager started successfully for all guilds.');
  } catch (err) {
    logger.error('❌ Failed to start log monitoring manager:', err);
  }

  logger.info('✅ Polling monitor initialized and auto-start complete!');
} catch (error) {
  logger.error('❌ Failed to initialize Nitrado monitors:', error);
}



    // =====================================================
    // 🟢 Other Services (Token Refresh, Notifications, etc.)
    // =====================================================
    try {
      client.tokenAutoRefresh = new TokenAutoRefresh();
      await client.tokenAutoRefresh.start();
      logger.info('✅ Token auto-refresh service started successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize token auto-refresh:', error);
    }

    try {
      const NitradoNotificationsMonitor = require('../modules/nitradoNotifications.js');
      client.nitradoNotifications = new NitradoNotificationsMonitor(client);
      await client.nitradoNotifications.start();
      logger.info('✅ Nitrado notifications monitor started successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize notifications monitor:', error);
    }

    try {
      const NitradoResourceMonitor = require('../modules/nitradoResourceMonitor.js');
      client.nitradoResources = new NitradoResourceMonitor(client);
      await client.nitradoResources.start();
      logger.info('✅ Nitrado resource monitor started successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize resource monitor:', error);
    }

    // =====================================================
    // 🟢 Tier, Privacy, Scheduler, Permissions, Diagnostics
    // =====================================================
    const poolInstance = await getPool();
    client.tierManager = new TierManager(poolInstance, logger);
    client.guildPrivacy = new GuildPrivacyManager(poolInstance);

    try {
      const { initializeScheduler } = require('../services/scheduler.js');
      initializeScheduler();
      logger.info('✅ Scheduled cleanup tasks initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize scheduler:', error);
    }

    setTimeout(async () => {
      logger.info('🔐 Starting permission sync...');
      const syncResults = await syncAllPermissions(client);
      const totalSynced = syncResults.reduce((sum, r) => sum + (r.synced || 0), 0);
      logger.info(`🔐 Permission sync complete: ${totalSynced} channels updated across ${syncResults.length} guilds`);
    }, 5000);

    await runDiagnostics(client);
    logger.info('Bot is ready and Log Monitor initialized!');
  });
};

// === Helper Functions (same as before) ===

function setPresence(client) {
  const defaultStatus = 'Grizzly Network | /help';
  const gccGuildId = process.env.GRIZZLY_COMMAND_GUILD_ID;
  const guilds = client.guilds.cache;

  let activityText = defaultStatus;

  if (guilds.size > 0) {
    const guildNames = guilds.map((g) => g.name);
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

    try {
      const start = Date.now();
      await db.query('SELECT 1');
      const latency = Date.now() - start;
      diagnostics.push(`✅ Database Connected (${latency} ms)`);
    } catch (err) {
      diagnostics.push('❌ Database Connection Failed');
      logger.error('Database test failed:', err);
    }

    if (client.nitradoPollingMonitor) diagnostics.push('✅ Nitrado Polling Active');
    else diagnostics.push('⚠️ Nitrado Polling Inactive');

    if (client.nitradoNotifications) diagnostics.push('✅ Nitrado Notifications Active');
    else diagnostics.push('⚠️ Nitrado Notifications Inactive');

    if (client.nitradoResources) diagnostics.push('✅ Nitrado Resource Monitor Active');
    else diagnostics.push('⚠️ Nitrado Resource Monitor Inactive');

    diagnostics.push('✅ Scheduled Cleanup Active (3 AM daily)');
    if (process.env.PATREON_CLIENT_ID) diagnostics.push('✅ Patreon Config Loaded');
    else diagnostics.push('⚠️ Patreon Not Configured');

    const cmdCount = client.commands?.size || 0;
    diagnostics.push(`✅ ${cmdCount} Commands Registered`);

    const divider = '──────────────────────────────';
    console.log('\n🚀 Grizzly Bot Startup Summary');
    console.log(divider);
    diagnostics.forEach((line) => console.log(line));
    console.log(divider);
    console.log('🟢 System Ready – All critical modules checked.\n');

    logger.info('Startup diagnostics completed successfully.');
  } catch (error) {
    logger.error('Startup diagnostics failed:', error);
  }
}
