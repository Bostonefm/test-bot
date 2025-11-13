const { createNitradoAPI } = require('./nitrado.js');
const { db, pool } = require('./db.js');
const logger = require('../utils/logger.js');
const fs = require('fs');
const path = require('path');

class ConfigFileMonitor {
  constructor() {
    this.monitoringInterval = null;
    this.isRunning = false;
    this.downloadPath = path.join(__dirname, '../downloads');
    this.checkInterval = 5 * 60 * 1000; // 5 minutes
  }

  // Start monitoring for config file changes
  async startMonitoring() {
    if (this.isRunning) {
      logger.warn('Config file monitoring is already running');
      return;
    }

    this.isRunning = true;
    this.isCheckRunning = false; // Prevent overlapping checks
    logger.info('🔍 Starting config file monitoring for ADM/RPT files');

    // Create downloads directory if it doesn't exist
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }

    // Run initial check
    await this.checkAndDownloadFiles();

    // Set up interval with recursive setTimeout to prevent overlap
    const checkLoop = async () => {
      if (!this.isRunning) return; // Stop if monitoring stopped
      
      if (this.isCheckRunning) {
        // Skip if previous check still running
        this.monitoringInterval = setTimeout(checkLoop, this.checkInterval);
        return;
      }
      
      this.isCheckRunning = true;
      try {
        await this.checkAndDownloadFiles();
      } catch (error) {
        logger.error('Config file monitoring interval error:', error);
      } finally {
        this.isCheckRunning = false;
        // Schedule next check
        if (this.isRunning) {
          this.monitoringInterval = setTimeout(checkLoop, this.checkInterval);
        }
      }
    };

    // Start periodic checks
    this.monitoringInterval = setTimeout(checkLoop, this.checkInterval);

    logger.info(
      `✅ Config file monitoring started - checking every ${this.checkInterval / 60000} minutes`
    );
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearTimeout(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    this.isCheckRunning = false;
    logger.info('🛑 Config file monitoring stopped');
  }

  // Check and download new files
  async checkAndDownloadFiles() {
    try {
      // Get all monitored servers
      const result = await pool.query(`
        SELECT guild_id, service_id, paths
        FROM config_monitoring 
        WHERE active = true
      `);

      for (const server of result.rows) {
        await this.processServerFiles(server);
      }
    } catch (error) {
      logger.error('Error in checkAndDownloadFiles:', error);
    }
  }

  // Process files for a specific server
  async processServerFiles(server) {
    const { guild_id, service_id, paths } = server;
    
    try {
      // Get Nitrado credentials
      const credsResult = await pool.query(
        'SELECT encrypted_token FROM nitrado_credentials WHERE guild_id = $1 AND service_id = $2',
        [guild_id, service_id]
      );

      if (!credsResult.rows.length) {
        return;
      }

      const api = createNitradoAPI(credsResult.rows[0].encrypted_token);
      const pathsToCheck = JSON.parse(paths);

      for (const path of pathsToCheck) {
        await this.checkPathForFiles(api, service_id, path);
      }
    } catch (error) {
      logger.error(`Error processing server files for ${service_id}:`, error);
    }
  }

  // Check a specific path for files
  async checkPathForFiles(api, serviceId, path) {
    try {
      const response = await api.listFiles(serviceId, path);
      const files = response.data?.entries || [];

      // Filter for ADM and RPT files
      const logFiles = files.filter(file => {
        const name = file.name || file.filename;
        return name && (name.includes('.RPT') || name.includes('.ADM'));
      });

      // Download latest files
      for (const file of logFiles.slice(0, 3)) {
        await this.downloadFile(api, serviceId, path, file);
      }
    } catch (error) {
      logger.debug(`Could not check path ${path}: ${error.message}`);
    }
  }

  // Download a specific file
  async downloadFile(api, serviceId, path, file) {
    try {
      const fileName = file.name || file.filename;
      const localPath = `${this.downloadPath}/${serviceId}_${fileName}`;
      
      // Skip if already downloaded recently
      if (fs.existsSync(localPath)) {
        const stats = fs.statSync(localPath);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        if (ageHours < 1) {
          return; // Skip if downloaded within last hour
        }
      }

      const content = await api.readFile(serviceId, `${path}/${fileName}`);
      
      if (content.success && content.content) {
        fs.writeFileSync(localPath, content.content);
        logger.info(`📁 Downloaded: ${fileName} (${file.size} bytes)`);
      }
    } catch (error) {
      logger.debug(`Could not download file: ${error.message}`);
    }
  }

  // Get monitoring status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck || null,
      filesDownloaded: this.filesDownloaded || 0
    };
  }

  // Get recent downloads
  getRecentDownloads() {
    try {
      if (!fs.existsSync(this.downloadPath)) {
        return [];
      }

      const files = fs.readdirSync(this.downloadPath);
      return files.map(file => {
        const stats = fs.statSync(`${this.downloadPath}/${file}`);
        return {
          fileName: file,
          path: this.downloadPath,
          size: stats.size,
          downloadTime: stats.mtime.toISOString()
        };
      }).sort((a, b) => new Date(b.downloadTime) - new Date(a.downloadTime));
    } catch (error) {
      logger.error('Error getting recent downloads:', error);
      return [];
    }
  }

  // Check and download latest files
  async checkAndDownloadFiles() {
    try {
      // Get token from database
      const result = await db.query(
        'SELECT encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE service_id = $1 ORDER BY updated_at DESC LIMIT 1',
        ['12326241']
      );

      if (!result.rows[0]) {
        logger.error('❌ No token found in database for service 12326241');
        return;
      }

      const { encrypted_token, token_iv, auth_tag } = result.rows[0];
      const token = decrypt(encrypted_token, token_iv, auth_tag);

      const api = createNitradoAPI(token);
      const serviceId = '12326241';
      const configPath = '/games/ni8504127_1/noftp/dayzps/config';

      logger.info(`🔍 Checking for latest ADM/RPT files in: ${configPath}`);

      // List files in the directory
      const response = await api.listFiles(serviceId, configPath);
      const files = response.data?.entries || [];

      if (files.length === 0) {
        logger.warn('❌ No files found in config directory');
        return;
      }

      // Filter for ADM and RPT files
      const logFiles = files.filter(file => {
        const name = file.name || file.filename || '';
        return name.endsWith('.ADM') || name.endsWith('.RPT');
      });

      if (logFiles.length === 0) {
        logger.warn('❌ No ADM or RPT files found');
        return;
      }

      // Sort by last modified time (most recent first)
      logFiles.sort((a, b) => {
        const timeA = new Date(a.last_modified || a.mtime || 0);
        const timeB = new Date(b.last_modified || b.mtime || 0);
        return timeB - timeA;
      });

      // Get the latest ADM and RPT files
      const latestADM = logFiles.find(f => (f.name || f.filename).endsWith('.ADM'));
      const latestRPT = logFiles.find(f => (f.name || f.filename).endsWith('.RPT'));

      const filesToDownload = [];
      if (latestADM) {
        filesToDownload.push(latestADM);
      }
      if (latestRPT) {
        filesToDownload.push(latestRPT);
      }

      logger.info(`📋 Found ${filesToDownload.length} latest files to check`);

      // Download each file
      for (const file of filesToDownload) {
        await this.downloadFileIfModified(api, serviceId, configPath, file);
      }
    } catch (error) {
      logger.error('❌ Error in checkAndDownloadFiles:', error);
    }
  }

  // Download file if it has been modified since last download
  async downloadFileIfModified(api, serviceId, configPath, file) {
    try {
      const fileName = file.name || file.filename;
      const fileSize = file.size || 0;
      const lastModified = new Date(file.last_modified || file.mtime || Date.now());

      // Check if we already have this version of the file
      const existingFiles = fs
        .readdirSync(this.downloadPath)
        .filter(f => f.includes(fileName))
        .sort()
        .reverse();

      let shouldDownload = true;

      if (existingFiles.length > 0) {
        // Check the most recent download
        const latestDownload = existingFiles[0];
        const latestDownloadPath = path.join(this.downloadPath, latestDownload);
        const localStat = fs.statSync(latestDownloadPath);

        // Compare file sizes (simple check for modifications)
        if (localStat.size === fileSize) {
          logger.debug(
            `📄 ${fileName} - No changes detected (size: ${Math.round(fileSize / 1024)}KB)`
          );
          shouldDownload = false;
        }
      }

      if (shouldDownload) {
        logger.info(`📥 Downloading updated file: ${fileName} (${Math.round(fileSize / 1024)}KB)`);

        const filePath = `${configPath}/${fileName}`;
        const fileContent = await api.downloadFile(serviceId, filePath);

        if (fileContent && fileContent.length > 0) {
          // Save file with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const localFileName = `${timestamp}_dayzps_${fileName}`;
          const localFilePath = path.join(this.downloadPath, localFileName);

          fs.writeFileSync(localFilePath, fileContent);

          logger.info(`✅ Downloaded: ${localFileName}`);
          logger.info(`📊 Size: ${Math.round(fileContent.length / 1024)}KB`);
          logger.info(`🕒 Last Modified: ${lastModified.toISOString()}`);

          // Keep only the last 10 versions of each file type
          await this.cleanupOldFiles(fileName);

          // Update database with download record
          await this.recordDownload(serviceId, fileName, localFilePath, fileSize);
        } else {
          logger.warn(`❌ Downloaded file ${fileName} is empty`);
        }
      }
    } catch (error) {
      logger.error(`❌ Error downloading ${file.name || file.filename}:`, error.message);
    }
  }

  // Clean up old downloaded files (keep only last 10 versions)
  async cleanupOldFiles(fileName) {
    try {
      const fileType = fileName.split('.').pop();
      const existingFiles = fs
        .readdirSync(this.downloadPath)
        .filter(f => f.includes(fileName.replace(/\.\w+$/, '')) && f.endsWith(`.${fileType}`))
        .map(f => ({
          name: f,
          path: path.join(this.downloadPath, f),
          stat: fs.statSync(path.join(this.downloadPath, f)),
        }))
        .sort((a, b) => b.stat.mtime - a.stat.mtime);

      // Keep only the 10 most recent files
      const filesToDelete = existingFiles.slice(10);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        logger.debug(`🗑️ Cleaned up old file: ${file.name}`);
      }

      if (filesToDelete.length > 0) {
        logger.info(`🧹 Cleaned up ${filesToDelete.length} old ${fileType} files`);
      }
    } catch (error) {
      logger.error('Error cleaning up old files:', error);
    }
  }

  // Record download in database
  async recordDownload(serviceId, fileName, localPath, fileSize) {
    try {
      await db.query(
        `
        INSERT INTO file_downloads (service_id, file_name, local_path, file_size, downloaded_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
        [serviceId, fileName, localPath, fileSize]
      );
    } catch (error) {
      // Table might not exist, create it
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS file_downloads (
            id SERIAL PRIMARY KEY,
            service_id VARCHAR(50) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            local_path TEXT NOT NULL,
            file_size BIGINT,
            downloaded_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // Retry insert
        await db.query(
          `
          INSERT INTO file_downloads (service_id, file_name, local_path, file_size, downloaded_at)
          VALUES ($1, $2, $3, $4, NOW())
        `,
          [serviceId, fileName, localPath, fileSize]
        );
      } catch (createError) {
        logger.error('Error recording download:', createError);
      }
    }
  }

  // Get monitoring status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      downloadPath: this.downloadPath,
      nextCheck: this.isRunning ? new Date(Date.now() + this.checkInterval) : null,
    };
  }

  // Get recent downloads
  async getRecentDownloads(limit = 20) {
    try {
      const result = await db.query(
        `
        SELECT file_name, local_path, file_size, downloaded_at
        FROM file_downloads
        ORDER BY downloaded_at DESC
        LIMIT $1
      `,
        [limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting recent downloads:', error);
      return [];
    }
  }
}

module.exports = { ConfigFileMonitor };
