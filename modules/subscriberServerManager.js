
const { createNitradoAPI } = require('./nitrado');
const { pool } = require('./db');
const { logger } = require('./logger');
const { decrypt } = require('../utils/encryption');

/**
 * Enhanced Subscriber Server Manager
 * Efficiently extracts and manages server information for subscribers
 */
class SubscriberServerManager {
  constructor() {
    this.serverCache = new Map();
    this.lastCacheUpdate = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get comprehensive server information for a subscriber
   * Uses the enhanced gameserver endpoint data
   */
  async getServerInfo(guildId, useCache = true) {
    try {
      // Check cache first
      if (useCache && this.isServerCached(guildId)) {
        return this.serverCache.get(guildId);
      }

      // Get Nitrado credentials
      const credResult = await pool.query(
        'SELECT service_id, encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE guild_id = $1',
        [guildId]
      );

      if (credResult.rows.length === 0) {
        throw new Error('No Nitrado connection found for this server');
      }

      const { service_id, encrypted_token, token_iv, auth_tag } = credResult.rows[0];
      const decryptedToken = decrypt(encrypted_token, token_iv, auth_tag);
      const api = createNitradoAPI(decryptedToken);

      // Get comprehensive server data
      const gameserverResponse = await api.getGameserver(service_id);
      const serverData = gameserverResponse.data?.gameserver;

      if (!serverData) {
        throw new Error('Invalid gameserver response');
      }

      // Extract and organize all the useful information
      const serverInfo = {
        // Basic Info
        serviceId: serverData.service_id,
        username: serverData.username,
        userId: serverData.user_id,
        guildId: guildId,
        
        // Server Status
        status: serverData.status,
        lastStatusChange: new Date(serverData.last_status_change * 1000),
        mustBeStarted: serverData.must_be_started,
        
        // Connection Info
        ip: serverData.ip,
        port: serverData.port,
        queryPort: serverData.query_port,
        rconPort: serverData.rcon_port,
        
        // Game Info
        game: serverData.game,
        gameHuman: serverData.game_human,
        slots: serverData.slots,
        location: serverData.location,
        memory: serverData.memory_mb,
        
        // Paths and Files
        gamePath: serverData.game_specific?.path,
        logFiles: serverData.game_specific?.log_files || [],
        configFiles: serverData.game_specific?.config_files || [],
        pathAvailable: serverData.game_specific?.path_available,
        
        // Features
        features: serverData.game_specific?.features || {},
        
        // Credentials (for advanced operations)
        ftpCredentials: serverData.credentials?.ftp,
        mysqlCredentials: serverData.credentials?.mysql,
        
        // WebSocket Token for real-time monitoring
        websocketToken: serverData.websocket_token,
        
        // Host Systems
        hostSystems: serverData.hostsystems,
        
        // Settings
        serverSettings: serverData.settings,
        
        // Update Info
        updateStatus: serverData.game_specific?.update_status,
        lastUpdate: serverData.game_specific?.last_update,
        
        // Cache timestamp
        lastUpdated: new Date()
      };

      // Cache the result
      this.serverCache.set(guildId, serverInfo);
      this.lastCacheUpdate.set(guildId, Date.now());

      logger.info(`📊 Retrieved server info for guild ${guildId}, service ${service_id}`);
      return serverInfo;

    } catch (error) {
      logger.error(`Failed to get server info for guild ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Get log file paths efficiently
   */
  async getLogPaths(guildId) {
    const serverInfo = await this.getServerInfo(guildId);
    
    const logPaths = {
      basePath: serverInfo.gamePath,
      fullPaths: serverInfo.logFiles.map(logFile => `${serverInfo.gamePath}${logFile}`),
      latestRPT: null,
      latestADM: null
    };

    // Find latest log files
    const rptFiles = serverInfo.logFiles.filter(f => f.endsWith('.RPT')).sort().reverse();
    const admFiles = serverInfo.logFiles.filter(f => f.endsWith('.ADM')).sort().reverse();

    if (rptFiles.length > 0) {
      logPaths.latestRPT = `${serverInfo.gamePath}${rptFiles[0]}`;
    }

    if (admFiles.length > 0) {
      logPaths.latestADM = `${serverInfo.gamePath}${admFiles[0]}`;
    }

    return logPaths;
  }

  /**
   * Get server status efficiently
   */
  async getServerStatus(guildId) {
    const serverInfo = await this.getServerInfo(guildId);
    
    return {
      status: serverInfo.status,
      online: serverInfo.status === 'started',
      lastStatusChange: serverInfo.lastStatusChange,
      ip: serverInfo.ip,
      port: serverInfo.port,
      slots: serverInfo.slots,
      location: serverInfo.location,
      gameType: serverInfo.gameHuman
    };
  }

  /**
   * Get FTP access info for direct file operations
   */
  async getFTPAccess(guildId) {
    const serverInfo = await this.getServerInfo(guildId);
    
    if (!serverInfo.ftpCredentials) {
      throw new Error('FTP credentials not available');
    }

    return {
      hostname: serverInfo.ftpCredentials.hostname,
      port: serverInfo.ftpCredentials.port,
      username: serverInfo.ftpCredentials.username,
      password: serverInfo.ftpCredentials.password,
      basePath: serverInfo.gamePath
    };
  }

  /**
   * Get WebSocket info for real-time monitoring
   */
  async getWebSocketInfo(guildId) {
    const serverInfo = await this.getServerInfo(guildId);
    
    return {
      token: serverInfo.websocketToken,
      serviceId: serverInfo.serviceId,
      endpoint: `wss://api.nitrado.net/services/${serverInfo.serviceId}/gameservers/websocket`,
      features: serverInfo.features
    };
  }

  /**
   * Check if server data is cached and still valid
   */
  isServerCached(guildId) {
    const lastUpdate = this.lastCacheUpdate.get(guildId);
    if (!lastUpdate || !this.serverCache.has(guildId)) {
      return false;
    }
    
    return (Date.now() - lastUpdate) < this.cacheTimeout;
  }

  /**
   * Clear cache for a specific guild
   */
  clearCache(guildId) {
    this.serverCache.delete(guildId);
    this.lastCacheUpdate.delete(guildId);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.serverCache.clear();
    this.lastCacheUpdate.clear();
  }

  /**
   * Get multiple server info for dashboard
   */
  async getBulkServerInfo(guildIds) {
    const results = {};
    
    for (const guildId of guildIds) {
      try {
        results[guildId] = await this.getServerInfo(guildId);
      } catch (error) {
        logger.error(`Failed to get server info for guild ${guildId}:`, error);
        results[guildId] = { error: error.message };
      }
    }
    
    return results;
  }

  /**
   * Extract subscriber tier information based on server features
   */
  getSubscriberTier(serverInfo) {
    const features = serverInfo.features || {};
    
    // Determine tier based on available features
    if (features.has_expert_mode && features.has_plugin_system) {
      return 'premium';
    } else if (features.has_rcon || features.has_database) {
      return 'standard';
    } else {
      return 'basic';
    }
  }
}

module.exports = { SubscriberServerManager };
