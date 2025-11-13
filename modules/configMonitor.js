const { pool } = require('./db.js');
const { createNitradoAPI } = require('./nitrado.js');
const { logger } = require('./logger');

class ConfigMonitor {
  constructor() {
    this.monitoringInterval = null;
    this.isRunning = false;
  }

  // Start the config monitoring service
  async startMonitoring() {
    if (this.isRunning) {
      logger.warn('Config monitoring is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔍 Starting config file monitoring service');

    // Run initial check
    await this.checkAllMonitoredServers();

    // Set up interval (every 5 minutes)
    this.monitoringInterval = setInterval(
      async () => {
        try {
          await this.checkAllMonitoredServers();
        } catch (error) {
          logger.error('Config monitoring interval error:', error);
        }
      },
      5 * 60 * 1000
    );
  }

  // Stop the monitoring service
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    logger.info('🛑 Config file monitoring service stopped');
  }

  // Check all servers that have monitoring enabled
  async checkAllMonitoredServers() {
    try {
      const result = await pool.query(`
        SELECT guild_id, service_id, paths, file_states
        FROM config_monitoring 
        WHERE active = true
      `);

      logger.debug(`📊 Checking ${result.rows.length} monitored servers`);

      for (const server of result.rows) {
        try {
          await this.checkServerConfigChanges(server);
        } catch (serverError) {
          logger.error(`Error checking server ${server.service_id}:`, serverError);
        }
      }

      // Update last check timestamp
      await pool.query(`
        UPDATE config_monitoring 
        SET last_check = NOW() 
        WHERE active = true
      `);
    } catch (error) {
      logger.error('Error in checkAllMonitoredServers:', error);
    }
  }

  // Check config changes for a specific server
  async checkServerConfigChanges(server) {
    const { guild_id, service_id, paths, file_states } = server;

    try {
      // Get Nitrado credentials
      const credsResult = await pool.query(
        'SELECT encrypted_token FROM nitrado_credentials WHERE guild_id = $1 AND service_id = $2',
        [guild_id, service_id]
      );

      if (!credsResult.rows.length) {
        logger.warn(`No Nitrado credentials found for guild ${guild_id}, service ${service_id}`);
        return;
      }

      const api = createNitradoAPI(credsResult.rows[0].encrypted_token);
      const pathsToCheck = JSON.parse(paths);
      const currentFileStates = file_states || {};
      const newFileStates = { ...currentFileStates };
      const changes = [];

      // Check each monitored path
      for (const path of pathsToCheck.slice(0, 3)) {
        // Limit to 3 paths to respect API limits
        try {
          const response = await api.listFiles(service_id, path);
          const files = response.data?.entries || [];

          // Check for changes in each file
          for (const file of files) {
            const fileName = file.name || file.filename;
            if (!fileName) {
              continue;
            }

            const fileKey = `${path}/${fileName}`;
            const currentSize = file.size || 0;
            const currentModified = new Date(
              file.date || file.last_modified || Date.now()
            ).getTime();

            const lastState = currentFileStates[fileKey];

            if (!lastState) {
              // New file detected
              changes.push({
                type: 'created',
                path: path,
                fileName: fileName,
                newSize: currentSize,
                filePath: fileKey,
              });

              newFileStates[fileKey] = {
                size: currentSize,
                lastModified: currentModified,
                firstSeen: Date.now(),
              };
            } else if (currentSize !== lastState.size || currentModified > lastState.lastModified) {
              // File modified
              changes.push({
                type: 'modified',
                path: path,
                fileName: fileName,
                oldSize: lastState.size,
                newSize: currentSize,
                filePath: fileKey,
              });

              newFileStates[fileKey] = {
                ...lastState,
                size: currentSize,
                lastModified: currentModified,
                lastChanged: Date.now(),
              };
            }
          }

          // Check for deleted files (files that were tracked but no longer exist)
          const currentFileNames = files.map(f => f.name || f.filename).filter(Boolean);
          for (const [trackedFileKey, trackedState] of Object.entries(currentFileStates)) {
            if (trackedFileKey.startsWith(path + '/')) {
              const trackedFileName = trackedFileKey.split('/').pop();
              if (!currentFileNames.includes(trackedFileName)) {
                changes.push({
                  type: 'deleted',
                  path: path,
                  fileName: trackedFileName,
                  oldSize: trackedState.size,
                  filePath: trackedFileKey,
                });

                delete newFileStates[trackedFileKey];
              }
            }
          }
        } catch (pathError) {
          logger.warn(
            `Could not check path ${path} for service ${service_id}: ${pathError.message}`
          );
        }
      }

      // Process and record changes
      if (changes.length > 0) {
        await this.recordChanges(guild_id, service_id, changes);
        logger.info(`📝 Detected ${changes.length} config file changes for service ${service_id}`);
      }

      // Update file states in database
      await pool.query(
        `
        UPDATE config_monitoring 
        SET file_states = $1 
        WHERE guild_id = $2 AND service_id = $3
      `,
        [JSON.stringify(newFileStates), guild_id, service_id]
      );
    } catch (error) {
      logger.error(`Error checking config changes for service ${service_id}:`, error);
    }
  }

  // Record changes in the database
  async recordChanges(guildId, serviceId, changes) {
    for (const change of changes) {
      try {
        await pool.query(
          `
          INSERT INTO config_file_changes 
          (guild_id, service_id, file_path, file_name, change_type, old_size, new_size)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [
            guildId,
            serviceId,
            change.filePath,
            change.fileName,
            change.type,
            change.oldSize || null,
            change.newSize || null,
          ]
        );

        logger.info(`📁 [${change.type.toUpperCase()}] ${change.fileName} in ${change.path}`);
      } catch (dbError) {
        logger.error('Error recording config change:', dbError);
      }
    }
  }

  // Get recent changes for a server
  async getRecentChanges(guildId, serviceId, limit = 10) {
    try {
      const result = await pool.query(
        `
        SELECT file_path, file_name, change_type, old_size, new_size, detected_at
        FROM config_file_changes 
        WHERE guild_id = $1 AND service_id = $2
        ORDER BY detected_at DESC 
        LIMIT $3
      `,
        [guildId, serviceId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting recent changes:', error);
      return [];
    }
  }

  // Get monitoring status for a server
  async getMonitoringStatus(guildId, serviceId) {
    try {
      const result = await pool.query(
        `
        SELECT active, started_at, last_check, paths
        FROM config_monitoring 
        WHERE guild_id = $1 AND service_id = $2
      `,
        [guildId, serviceId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting monitoring status:', error);
      return null;
    }
  }
}

// Create singleton instance
const configMonitor = new ConfigMonitor();

// Standard DayZ PlayStation config paths to monitor
const configPaths = [
  `/games/${configMonitor.serviceId}_1/noftp/dayzps/config`,
  `/games/${configMonitor.serviceId}_1/ftproot/dayzps/config`,
  `/noftp/dayzps/config`,
  `/ftproot/dayzps/config`,
  `/dayzps/config`,
];

module.exports = {
  ConfigMonitor,
  configMonitor,
  configPaths,
};
