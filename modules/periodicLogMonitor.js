const { createNitradoAPI } = require('./nitrado');
const { pool } = require('./db');
const { decrypt } = require('../utils/encryption');
const { DayZLogAnalyzer } = require('./logAnalyzer');
const { logger } = require('./logger');
const fs = require('fs');
const path = require('path');

class PeriodicLogMonitor {
  constructor() {
    this.activeMonitors = new Map(); // serviceId -> monitor info
    this.logAnalyzer = new DayZLogAnalyzer();
    this.defaultInterval = 5 * 60 * 1000; // 5 minutes - respects API limits
    this.filePositions = new Map(); // Track last read positions
    this.rateLimitBuffer = 1000; // 1 second buffer between API calls
  }

  /**
   * Start periodic monitoring for a service
   */
  async startMonitoring(serviceId, onLogEvent, options = {}) {
    try {
      if (this.activeMonitors.has(serviceId)) {
        logger.info(`🔄 Monitor already active for service ${serviceId}`);
        return { success: true, message: 'Already monitoring' };
      }

      // Get API token
      const token = await this.getApiToken(serviceId);
      if (!token) {
        throw new Error('No API token found for service');
      }

      const api = createNitradoAPI(token);

      // Test API access first
      await this.testApiAccess(api, serviceId);

      const monitorInfo = {
        serviceId,
        token,
        api,
        onLogEvent,
        intervalId: null,
        isActive: true,
        startTime: Date.now(),
        lastCheck: null,
        eventsProcessed: 0,
        checksCompleted: 0,
        errors: 0,
        options: {
          interval: options.interval || this.defaultInterval,
          maxErrors: options.maxErrors || 10,
          ...options
        }
      };

      // Start periodic checking
      monitorInfo.intervalId = setInterval(() => {
        this.performCheck(monitorInfo);
      }, monitorInfo.options.interval);

      // Perform initial check
      await this.performCheck(monitorInfo);

      this.activeMonitors.set(serviceId, monitorInfo);

      logger.info(`🟢 Started periodic monitoring for service ${serviceId}`);
      logger.info(`⏱️ Check interval: ${Math.round(monitorInfo.options.interval / 1000)}s`);

      return { 
        success: true, 
        message: `Monitoring started with ${Math.round(monitorInfo.options.interval / 60000)}min intervals` 
      };

    } catch (error) {
      logger.error(`❌ Failed to start monitoring for ${serviceId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform a single monitoring check
   */
  async performCheck(monitorInfo) {
    try {
      if (!monitorInfo.isActive) {
        return;
      }

      const { serviceId, api, onLogEvent } = monitorInfo;

      logger.debug(`🔍 Performing check for service ${serviceId}`);

      // Get latest log files
      const latestFiles = await this.getLatestLogFiles(api, serviceId);

      if (latestFiles.length === 0) {
        logger.warn(`⚠️ No log files found for service ${serviceId}`);
        return;
      }

      let totalNewEvents = 0;

      // Process each file for new content
      for (const file of latestFiles) {
        try {
          // Add rate limiting delay between file checks
          if (latestFiles.indexOf(file) > 0) {
            await this.sleep(this.rateLimitBuffer);
          }

          const newEvents = await this.checkFileForNewContent(api, serviceId, file, onLogEvent);
          totalNewEvents += newEvents;

        } catch (fileError) {
          logger.warn(`⚠️ Error checking file ${file.name}:`, fileError.message);
          monitorInfo.errors++;
        }
      }

      // Update monitor stats
      monitorInfo.lastCheck = Date.now();
      monitorInfo.checksCompleted++;
      monitorInfo.eventsProcessed += totalNewEvents;

      if (totalNewEvents > 0) {
        logger.info(`📈 [${serviceId}] Found ${totalNewEvents} new events`);
      } else {
        logger.debug(`✅ [${serviceId}] Check completed - no new content`);
      }

      // Check for too many errors
      if (monitorInfo.errors >= monitorInfo.options.maxErrors) {
        logger.error(`❌ Too many errors for service ${serviceId}, stopping monitor`);
        this.stopMonitoring(serviceId);
      }

    } catch (error) {
      logger.error(`❌ Error during check for ${monitorInfo.serviceId}:`, error.message);
      monitorInfo.errors++;
    }
  }

  /**
   * Get latest log files from API
   */
  async getLatestLogFiles(api, serviceId) {
    try {
      const configPath = `/games/ni${serviceId}_1/noftp/dayzps/config`;

      logger.debug(`📂 Checking for latest logs in: ${configPath}`);

      const response = await api.listFiles(serviceId, configPath, false, 2); // Only first 2 pages

      if (response?.data?.entries) {
        const files = response.data.entries.filter(entry => entry.type === 'file');

        // Get the most recent RPT and ADM files
        const latestFiles = this.logAnalyzer.getMostRecentLogFiles(files, 2);

        return latestFiles.map(file => ({
          ...file,
          fullPath: `${configPath}/${file.name}`
        }));
      }

      return [];
    } catch (error) {
      logger.error(`❌ Error getting log files for ${serviceId}:`, error.message);
      return [];
    }
  }

  /**
   * Check a specific file for new content
   */
  async checkFileForNewContent(api, serviceId, file, onLogEvent) {
    try {
      const fileKey = `${serviceId}:${file.name}`;
      const lastPosition = this.filePositions.get(fileKey) || 0;
      const currentSize = file.size || 0;

      // No new content if file hasn't grown
      if (currentSize <= lastPosition) {
        return 0;
      }

      logger.debug(`📖 Reading new content from ${file.name}: ${lastPosition} -> ${currentSize}`);

      // Download new content
      const newContent = await this.readNewFileContent(api, serviceId, file, lastPosition);

      if (!newContent || !newContent.trim()) {
        return 0;
      }

      // Update file position
      this.filePositions.set(fileKey, currentSize);

      // Process the new content
      const events = this.logAnalyzer.processIncrementalLogContentFromPosition(
        newContent,
        serviceId,
        file.name
      );

      // Send events to callback
      let processedEvents = 0;
      for (const event of events) {
        try {
          await onLogEvent(event);
          processedEvents++;
        } catch (callbackError) {
          logger.warn(`⚠️ Error in log event callback:`, callbackError.message);
        }
      }

      return processedEvents;
    } catch (error) {
      logger.error(`Error checking file for new content: ${error.message}`);
      return 0;
    }
  }

  /**
   * Read new content from a file starting at a specific position
   */
  async readNewFileContent(api, serviceId, file, startPosition) {
    try {
      // For now, read the entire file and extract the portion we need
      // This is not optimal but works with current Nitrado API limitations
      const response = await api.readFile(serviceId, file.fullPath || file.name);

      if (!response.success || !response.content) {
        return '';
      }

      const content = response.content;
      const contentBuffer = Buffer.from(content, 'utf8');

      // Extract only the new content from the specified position
      if (startPosition >= contentBuffer.length) {
        return '';
      }

      return contentBuffer.slice(startPosition).toString('utf8');
    } catch (error) {
      logger.error(`Error reading new file content: ${error.message}`);
      return '';
    }
  }

  /**
   * Stop monitoring for a service
   */
  stopMonitoring(serviceId) {
    const monitorInfo = this.activeMonitors.get(serviceId);

    if (!monitorInfo) {
      logger.warn(`⚠️ No active monitor found for service ${serviceId}`);
      return { success: false, message: 'No active monitor' };
    }

    // Clear interval
    if (monitorInfo.intervalId) {
      clearInterval(monitorInfo.intervalId);
    }

    // Clean up file positions
    const keysToDelete = Array.from(this.filePositions.keys()).filter(key =>
      key.startsWith(`${serviceId}:`)
    );
    keysToDelete.forEach(key => this.filePositions.delete(key));

    // Remove from active monitors
    this.activeMonitors.delete(serviceId);

    const uptime = Date.now() - monitorInfo.startTime;
    const uptimeHours = Math.round(uptime / (60 * 60 * 1000) * 10) / 10;

    logger.info(`🛑 Stopped monitoring for service ${serviceId}`);
    logger.info(`📊 Final stats: ${monitorInfo.eventsProcessed} events, ${monitorInfo.checksCompleted} checks, ${uptimeHours}h uptime`);

    return { 
      success: true, 
      message: 'Monitoring stopped',
      stats: {
        eventsProcessed: monitorInfo.eventsProcessed,
        checksCompleted: monitorInfo.checksCompleted,
        errors: monitorInfo.errors,
        uptime: uptime
      }
    };
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(serviceId) {
    const monitorInfo = this.activeMonitors.get(serviceId);

    if (!monitorInfo) {
      return { active: false };
    }

    const uptime = Date.now() - monitorInfo.startTime;
    const timeSinceLastCheck = monitorInfo.lastCheck ? Date.now() - monitorInfo.lastCheck : null;

    return {
      active: monitorInfo.isActive,
      serviceId: serviceId,
      startTime: monitorInfo.startTime,
      lastCheck: monitorInfo.lastCheck,
      timeSinceLastCheck: timeSinceLastCheck,
      checksCompleted: monitorInfo.checksCompleted,
      eventsProcessed: monitorInfo.eventsProcessed,
      errors: monitorInfo.errors,
      uptime: uptime,
      interval: monitorInfo.options.interval,
      filesTracked: Array.from(this.filePositions.keys()).filter(key => 
        key.startsWith(`${serviceId}:`)).length
    };
  }

  /**
   * Get all active monitors
   */
  getAllMonitors() {
    const monitors = {};

    for (const [serviceId] of this.activeMonitors) {
      monitors[serviceId] = this.getMonitoringStatus(serviceId);
    }

    return monitors;
  }

  /**
   * Update monitoring interval for a service
   */
  updateInterval(serviceId, newInterval) {
    const monitorInfo = this.activeMonitors.get(serviceId);

    if (!monitorInfo) {
      return { success: false, message: 'No active monitor' };
    }

    // Minimum 2 minutes to respect API limits
    const safeInterval = Math.max(newInterval, 2 * 60 * 1000);

    // Clear old interval and set new one
    if (monitorInfo.intervalId) {
      clearInterval(monitorInfo.intervalId);
    }

    monitorInfo.options.interval = safeInterval;
    monitorInfo.intervalId = setInterval(() => {
      this.performCheck(monitorInfo);
    }, safeInterval);

    logger.info(`⏱️ Updated interval for service ${serviceId} to ${Math.round(safeInterval / 1000)}s`);

    return { 
      success: true, 
      message: `Interval updated to ${Math.round(safeInterval / 60000)} minutes` 
    };
  }

  /**
   * Test API access
   */
  async testApiAccess(api, serviceId) {
    try {
      const testPath = `/games/ni${serviceId}_1/noftp/dayzps/config`;
      await api.listFiles(serviceId, testPath, false, 1);
      return true;
    } catch (error) {
      throw new Error(`Cannot access API: ${error.message}`);
    }
  }

  /**
   * Get API token from database
   */
  async getApiToken(serviceId) {
    try {
      const result = await pool.query(
        'SELECT encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE service_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [serviceId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const { encrypted_token, token_iv, auth_tag } = result.rows[0];
      return decrypt(encrypted_token, token_iv, auth_tag);
    } catch (error) {
      logger.error('❌ Error getting API token:', error);
      return null;
    }
  }

  /**
   * Sleep utility
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop all monitors
   */
  stopAllMonitoring() {
    const serviceIds = Array.from(this.activeMonitors.keys());

    for (const serviceId of serviceIds) {
      this.stopMonitoring(serviceId);
    }

    logger.info(`🛑 Stopped all ${serviceIds.length} active monitors`);

    return { 
      success: true, 
      message: `Stopped ${serviceIds.length} monitors` 
    };
  }

  async processLogFile(fileContent, fileName, serviceId, guildId) {
    try {
      // Parse the log content using the existing log analyzer
      const logAnalyzer = new DayZLogAnalyzer();
      const events = logAnalyzer.processLogContent(fileContent, serviceId, fileName);

      logger.info(`📊 Processed ${events.length} events from ${fileName}`);

      // Enhanced event processing with kill feed parsing
      const killParser = require('./killParser');
      const killEvents = killParser.parseKillFeed(fileContent);

      // Add kill events with proper metadata
      for (const kill of killEvents) {
        kill.guildId = guildId;
        kill.serviceId = serviceId;
        kill.fileName = fileName;
        events.push(kill);
      }

      // Process all events for notifications
      for (const event of events) {
        event.guildId = guildId;
        await this.processEvent(event);
      }

      return events;
    } catch (error) {
      logger.error(`Error processing log file ${fileName}:`, error);
      return [];
    }
  }

  async processEvent(event) {
    try {
      // Get Discord notification settings
      const channels = await this.getNotificationChannels(event.guildId);

      // Process different event types with enhanced notifications
      switch (event.type) {
        case 'player_join':
          if (channels.playerActivity) {
            await this.sendDiscordNotification(channels.playerActivity, this.formatPlayerJoinMessage(event));
          }
          // Update player tracking
          await this.updatePlayerStatus(event.serviceId, event.playerName, 'online', event.timestamp);
          break;

        case 'player_leave':
        case 'player_disconnect':
          if (channels.playerActivity) {
            await this.sendDiscordNotification(channels.playerActivity, this.formatPlayerLeaveMessage(event));
          }
          // Update player tracking
          await this.updatePlayerStatus(event.serviceId, event.playerName, 'offline', event.timestamp);
          break;

        case 'kill':
        case 'player_kill':
          if (channels.killFeed) {
            await this.sendDiscordNotification(channels.killFeed, this.formatKillMessage(event));
          }
          // Store kill statistics
          await this.recordKillEvent(event);
          break;

        case 'player_position':
          if (channels.playerLocation) {
            await this.sendDiscordNotification(channels.playerLocation, this.formatLocationMessage(event));
          }
          // Store location for tracking
          await this.updatePlayerLocation(event);
          break;

        case 'server_restart':
          if (channels.serverStatus) {
            await this.sendDiscordNotification(channels.serverStatus, this.formatRestartMessage(event));
          }
          // Clear all player statuses on restart
          await this.clearPlayerStatuses(event.serviceId);
          break;

        case 'admin_action':
          if (channels.adminActivity) {
            await this.sendDiscordNotification(channels.adminActivity, this.formatAdminMessage(event));
          }
          break;

        case 'base_building':
        case 'player_build':
          if (channels.buildingActivity) {
            await this.sendDiscordNotification(channels.buildingActivity, this.formatBuildingMessage(event));
          }
          break;

        case 'dynamic_event':
          if (channels.dynamicEvents) {
            await this.sendDiscordNotification(channels.dynamicEvents, this.formatDynamicEventMessage(event));
          }
          break;

        case 'vehicle_event':
          if (channels.vehicleActivity) {
            await this.sendDiscordNotification(channels.vehicleActivity, this.formatVehicleMessage(event));
          }
          break;

        case 'chat_message':
          if (channels.chatFeed) {
            await this.sendDiscordNotification(channels.chatFeed, this.formatChatMessage(event));
          }
          break;

        default:
          // Log unhandled event types for debugging
          if (event.priority === 'high' || event.type === 'server_warning') {
            if (channels.serverStatus) {
              await this.sendDiscordNotification(channels.serverStatus, this.formatGenericMessage(event));
            }
          }
          break;
      }
    } catch (error) {
      logger.error('Error processing event:', error);
    }
  }

  formatPlayerJoinMessage(event) {
    return {
      embeds: [{
        color: 0x00ff00,
        title: '🟢 Player Joined',
        description: `**${event.playerName}** connected to the server`,
        fields: [
          { name: 'Player ID', value: event.playerId || 'Unknown', inline: true },
          { name: 'Connection Time', value: `<t:${Math.floor(new Date(event.timestamp).getTime() / 1000)}:F>`, inline: true }
        ],
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatPlayerLeaveMessage(event) {
    return {
      embeds: [{
        color: 0xff0000,
        title: '🔴 Player Left',
        description: `**${event.playerName}** disconnected from the server`,
        fields: [
          { name: 'Player ID', value: event.playerId || 'Unknown', inline: true },
          { name: 'Disconnect Time', value: `<t:${Math.floor(new Date(event.timestamp).getTime() / 1000)}:F>`, inline: true }
        ],
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatKillMessage(event) {
    const killParser = require('./killParser');
    const locationStr = killParser.formatLocation(event.location);

    return {
      embeds: [{
        color: 0xff4444,
        title: '💀 Player Kill',
        description: `**${event.killer}** killed **${event.victim}**`,
        fields: [
          { name: 'Weapon', value: event.weapon || 'Unknown', inline: true },
          { name: 'Location', value: locationStr, inline: true },
          { name: 'Time', value: `<t:${Math.floor(new Date(event.timestamp).getTime() / 1000)}:R>`, inline: true }
        ],
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatLocationMessage(event) {
    return {
      embeds: [{
        color: 0x0099ff,
        title: '📍 Player Location',
        description: `**${event.playerName}** position update`,
        fields: [
          { name: 'Coordinates', value: event.position || 'Unknown', inline: true },
          { name: 'Player ID', value: event.playerId || 'Unknown', inline: true },
          { name: 'Updated', value: `<t:${Math.floor(new Date(event.timestamp).getTime() / 1000)}:R>`, inline: true }
        ],
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatRestartMessage(event) {
    return {
      embeds: [{
        color: 0xffaa00,
        title: '🔄 Server Restart',
        description: 'Server has restarted',
        fields: [
          { name: 'Restart Reason', value: event.restartReason || 'Unknown', inline: true },
          { name: 'Restart Time', value: `<t:${Math.floor(new Date(event.timestamp).getTime() / 1000)}:F>`, inline: true }
        ],
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatAdminMessage(event) {
    return {
      embeds: [{
        color: 0xff6600,
        title: '👮 Admin Action',
        description: `**${event.adminName}** ${event.action} **${event.targetPlayer}**`,
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatBuildingMessage(event) {
    return {
      embeds: [{
        color: 0x8b4513,
        title: '🔨 Building Activity',
        description: `**${event.playerName}** ${event.action} ${event.item || event.structure}`,
        fields: [
          { name: 'Location', value: event.location || 'Unknown', inline: true },
          { name: 'Action', value: event.action, inline: true }
        ],
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatDynamicEventMessage(event) {
    return {
      embeds: [{
        color: 0x9932cc,
        title: '🎯 Dynamic Event',
        description: `${event.eventType} has ${event.action}`,
        fields: [
          { name: 'Event Type', value: event.eventType, inline: true },
          { name: 'Action', value: event.action, inline: true },
          { name: 'Position', value: event.position || 'Unknown', inline: true }
        ],
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatVehicleMessage(event) {
    return {
      embeds: [{
        color: 0x4169e1,
        title: '🚗 Vehicle Activity',
        description: `**${event.playerName}** ${event.action} ${event.vehicleType}`,
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatChatMessage(event) {
    return {
      embeds: [{
        color: 0x87ceeb,
        title: '💬 Player Chat',
        description: `**${event.playerName}**: ${event.message}`,
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId}` }
      }]
    };
  }

  formatGenericMessage(event) {
    return {
      embeds: [{
        color: 0xffa500,
        title: '⚠️ Server Event',
        description: event.message || 'Server event detected',
        timestamp: event.timestamp,
        footer: { text: `Service: ${event.serviceId} | ${event.type}` }
      }]
    };
  }

  async getNotificationChannels(guildId) {
    try {
      const result = await pool.query(`
        SELECT 
          player_activity_channel_id,
          server_status_channel_id,
          kill_feed_channel_id,
          admin_activity_channel_id,
          building_activity_channel_id,
          vehicle_activity_channel_id,
          chat_feed_channel_id,
          player_location_channel_id,
          dynamic_events_channel_id
        FROM guild_channels 
        WHERE guild_id = $1
      `, [guildId]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          playerActivity: row.player_activity_channel_id,
          serverStatus: row.server_status_channel_id,
          killFeed: row.kill_feed_channel_id,
          adminActivity: row.admin_activity_channel_id,
          buildingActivity: row.building_activity_channel_id,
          vehicleActivity: row.vehicle_activity_channel_id,
          chatFeed: row.chat_feed_channel_id,
          playerLocation: row.player_location_channel_id,
          dynamicEvents: row.dynamic_events_channel_id
        };
      }

      return {};
    } catch (error) {
      logger.error('Error getting notification channels:', error);
      return {};
    }
  }

  async updatePlayerStatus(serviceId, playerName, status, timestamp) {
    try {
      await pool.query(`
        INSERT INTO player_status (service_id, player_name, status, last_seen)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (service_id, player_name) 
        DO UPDATE SET status = $3, last_seen = $4
      `, [serviceId, playerName, status, timestamp]);
    } catch (error) {
      logger.error('Error updating player status:', error);
    }
  }

  async recordKillEvent(event) {
    try {
      await pool.query(`
        INSERT INTO kill_events (
          service_id, killer_name, victim_name, weapon, 
          location_x, location_y, location_z, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        event.serviceId,
        event.killer,
        event.victim,
        event.weapon || 'Unknown',
        event.location?.x || 0,
        event.location?.y || 0,
        event.location?.z || 0,
        event.timestamp
      ]);
    } catch (error) {
      logger.error('Error recording kill event:', error);
    }
  }

  async updatePlayerLocation(event) {
    try {
      const coords = event.position?.split(',') || ['0', '0', '0'];
      await pool.query(`
        INSERT INTO player_locations (
          service_id, player_name, player_id, 
          location_x, location_y, location_z, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (service_id, player_name) 
        DO UPDATE SET 
          location_x = $4, location_y = $5, location_z = $6, 
          timestamp = $7, player_id = $3
      `, [
        event.serviceId,
        event.playerName,
        event.playerId || 'unknown',
        parseFloat(coords[0]) || 0,
        parseFloat(coords[1]) || 0,
        parseFloat(coords[2]) || 0,
        event.timestamp
      ]);
    } catch (error) {
      logger.error('Error updating player location:', error);
    }
  }

  async clearPlayerStatuses(serviceId) {
    try {
      await pool.query(`
        UPDATE player_status 
        SET status = 'offline', last_seen = NOW() 
        WHERE service_id = $1 AND status = 'online'
      `, [serviceId]);
    } catch (error) {
      logger.error('Error clearing player statuses:', error);
    }
  }

  async sendDiscordNotification(channelId, message) {
    try {
      if (!this.discordClient) {
        logger.warn('Discord client not available for notifications');
        return;
      }

      const channel = await this.discordClient.channels.fetch(channelId);
      if (channel) {
        await channel.send(message);
      }
    } catch (error) {
      logger.error('Error sending Discord notification:', error);
    }
  }
}

module.exports = PeriodicLogMonitor;
