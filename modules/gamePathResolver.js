import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * Normalize and validate a path to prevent directory traversal attacks
 * @param {string} inputPath - The path to normalize and validate
 * @param {boolean} allowAbsolute - Whether to allow absolute paths (default: false)
 * @returns {string} Normalized and validated path
 * @throws {Error} If path is invalid or contains dangerous patterns
 */
function normalizePath(inputPath, allowAbsolute = false) {
  if (typeof inputPath !== 'string') {
    throw new Error('Path must be a string');
  }

  // Remove null bytes and other dangerous characters
  if (inputPath.includes('\0') || inputPath.includes('\x00')) {
    throw new Error('Path contains null bytes');
  }

  // Normalize the path using POSIX style (consistent across platforms)
  let normalizedPath = path.posix.normalize(inputPath);

  // Check for directory traversal attempts
  if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
    throw new Error('Path contains directory traversal sequences');
  }

  // Ensure path doesn't start with .. after normalization
  if (normalizedPath.startsWith('../') || normalizedPath === '..') {
    throw new Error('Path attempts to escape base directory');
  }

  // Handle absolute vs relative paths
  if (path.posix.isAbsolute(normalizedPath)) {
    if (!allowAbsolute) {
      // For API paths, we typically want to allow absolute paths starting with /
      if (!normalizedPath.startsWith('/')) {
        throw new Error('Absolute paths must start with /');
      }
    }
  } else {
    // Ensure relative paths don't start with dangerous patterns
    if (normalizedPath.startsWith('./') || normalizedPath === '.') {
      normalizedPath = normalizedPath.replace(/^\.\//, '');
    }
  }

  // Ensure path doesn't end with dangerous patterns
  normalizedPath = normalizedPath.replace(/\/+$/, ''); // Remove trailing slashes

  return normalizedPath;
}

/**
 * Game Path Resolver - Handles game-specific path discovery
 */
class GamePathResolver {
  constructor() {
    this.gameConfig = null;
    this.loadConfig();
  }

  /**
   * Load game configuration from JSON file
   */
  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../config/game-paths.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      this.gameConfig = JSON.parse(configData);
      logger.info('✅ Game path configuration loaded successfully');
    } catch (error) {
      logger.error('❌ Failed to load game path configuration:', error.message);
      // Fallback to empty config
      this.gameConfig = { games: {}, defaultPaths: [] };
    }
  }

  /**
   * Get all possible paths for a specific game and platform
   * @param {string} game - Game identifier (e.g., 'dayz', 'minecraft')
   * @param {string} platform - Platform identifier (e.g., 'ps4', 'xbox', 'java')
   * @param {string} serviceId - Nitrado service ID
   * @param {string} userId - Nitrado user ID (optional)
   * @returns {Array} Array of resolved paths to try
   */
  getGamePaths(game, platform = 'default', serviceId, userId = null) {
    if (!this.gameConfig?.games?.[game]) {
      logger.warn(`Game '${game}' not found in configuration`);
      return this.getDefaultPaths(serviceId, userId);
    }

    const gameInfo = this.gameConfig.games[game];
    const platformInfo = gameInfo.platforms?.[platform] || gameInfo.platforms?.default;

    if (!platformInfo) {
      logger.warn(`Platform '${platform}' not found for game '${game}'`);
      return this.getDefaultPaths(serviceId, userId);
    }

    const paths = platformInfo.paths || [];
    return this.resolvePaths(paths, serviceId, userId);
  }

  /**
   * Get file patterns for a specific game and platform
   * @param {string} game - Game identifier
   * @param {string} platform - Platform identifier
   * @returns {Array} Array of file patterns to match
   */
  getFilePatterns(game, platform = 'default') {
    const gameInfo = this.gameConfig?.games?.[game];
    if (!gameInfo) {
      return ['*.log', '*.ADM', '*.RPT'];
    }

    const platformInfo = gameInfo.platforms?.[platform] || gameInfo.platforms?.default;
    return platformInfo?.filePatterns || ['*.log'];
  }

  /**
   * Get default fallback paths
   * @param {string} serviceId - Nitrado service ID
   * @param {string} userId - Nitrado user ID (optional)
   * @returns {Array} Array of default paths
   */
  getDefaultPaths(serviceId, userId = null) {
    const paths = this.gameConfig?.defaultPaths || [
      '/games/{serviceId}_1/ftproot',
      '/games/{serviceId}_1/noftp',
      '/logs',
      '/config',
    ];

    return this.resolvePaths(paths, serviceId, userId);
  }

  /**
   * Resolve path variables in path templates
   * @param {Array} pathTemplates - Array of path templates with variables
   * @param {string} serviceId - Service ID to substitute
   * @param {string} userId - User ID to substitute (optional)
   * @returns {Array} Array of resolved paths
   */
  resolvePaths(pathTemplates, serviceId, userId = null) {
    const resolvedPaths = [];

    // Validate input parameters
    if (!Array.isArray(pathTemplates)) {
      throw new Error('pathTemplates must be an array');
    }

    if (typeof serviceId !== 'string' || !serviceId.trim()) {
      throw new Error('serviceId must be a non-empty string');
    }

    // Sanitize serviceId and userId to prevent injection
    const cleanServiceId = serviceId.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanUserId = userId ? userId.replace(/[^a-zA-Z0-9_-]/g, '') : null;

    if (cleanServiceId !== serviceId) {
      logger.warn(
        `ServiceId contained invalid characters, sanitized from '${serviceId}' to '${cleanServiceId}'`
      );
    }

    if (userId && cleanUserId !== userId) {
      logger.warn(
        `UserId contained invalid characters, sanitized from '${userId}' to '${cleanUserId}'`
      );
    }

    for (const template of pathTemplates) {
      if (typeof template !== 'string') {
        logger.warn('Skipping non-string path template:', template);
        continue;
      }

      try {
        let resolvedPath = template.replace(/{serviceId}/g, cleanServiceId);

        if (cleanUserId) {
          resolvedPath = resolvedPath.replace(/{userId}/g, cleanUserId);
          // Normalize and validate the resolved path
          const normalizedPath = normalizePath(resolvedPath, true); // Allow absolute paths for API
          resolvedPaths.push(normalizedPath);
        } else if (template.includes('{userId}')) {
          // Skip paths that require userId if we don't have it
          continue;
        } else {
          // Normalize and validate the resolved path
          const normalizedPath = normalizePath(resolvedPath, true); // Allow absolute paths for API
          resolvedPaths.push(normalizedPath);
        }
      } catch (error) {
        logger.error(`Invalid path template '${template}': ${error.message}`);
        continue;
      }
    }

    return resolvedPaths;
  }

  /**
   * Find log files matching game patterns in a file list
   * @param {Array} files - Array of file objects from Nitrado API
   * @param {string} game - Game identifier
   * @param {string} platform - Platform identifier
   * @returns {Array} Array of matching log files
   */
  filterLogFiles(files, game, platform = 'default') {
    const patterns = this.getFilePatterns(game, platform);

    return files.filter(file => {
      const fileName = file.name || file.filename;
      if (!fileName) {
        return false;
      }

      return patterns.some(pattern => {
        // Convert glob pattern to regex
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\./g, '\\.');

        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(fileName);
      });
    });
  }

  /**
   * Auto-detect game type from service or file patterns
   * @param {Array} files - Array of file objects
   * @param {string} serviceName - Service name (optional)
   * @returns {Object} Detected game info { game, platform, confidence }
   */
  detectGame(files, serviceName = '') {
    const detectionResults = [];

    // Check each game configuration
    for (const [gameKey, gameInfo] of Object.entries(this.gameConfig?.games || {})) {
      for (const [platformKey, platformInfo] of Object.entries(gameInfo.platforms || {})) {
        const patterns = platformInfo.filePatterns || [];
        let matches = 0;

        // Count pattern matches
        for (const file of files) {
          const fileName = file.name || file.filename;
          if (!fileName) {
            continue;
          }

          for (const pattern of patterns) {
            const regexPattern = pattern
              .replace(/\*/g, '.*')
              .replace(/\?/g, '.')
              .replace(/\./g, '\\.');

            const regex = new RegExp(`^${regexPattern}$`, 'i');
            if (regex.test(fileName)) {
              matches++;
              break;
            }
          }
        }

        if (matches > 0) {
          const confidence = Math.min(matches / patterns.length, 1.0);
          detectionResults.push({
            game: gameKey,
            platform: platformKey,
            confidence: confidence,
            matches: matches,
          });
        }
      }
    }

    // Return best match
    if (detectionResults.length > 0) {
      detectionResults.sort((a, b) => b.confidence - a.confidence || b.matches - a.matches);
      return detectionResults[0];
    }

    return { game: 'unknown', platform: 'default', confidence: 0, matches: 0 };
  }

  /**
   * Get all supported games and platforms
   * @returns {Object} Object containing all game configurations
   */
  getSupportedGames() {
    return this.gameConfig?.games || {};
  }

  /**
   * Add or update game configuration
   * @param {string} game - Game identifier
   * @param {Object} gameConfig - Game configuration object
   */
  addGame(game, gameConfig) {
    if (!this.gameConfig.games) {
      this.gameConfig.games = {};
    }

    this.gameConfig.games[game] = gameConfig;
    this.saveConfig();
  }

  /**
   * Save configuration back to file
   */
  saveConfig() {
    try {
      const configPath = path.join(__dirname, '../config/game-paths.json');
      fs.writeFileSync(configPath, JSON.stringify(this.gameConfig, null, 2));
      logger.info('✅ Game path configuration saved successfully');
    } catch (error) {
      logger.error('❌ Failed to save game path configuration:', error.message);
    }
  }
}

export { GamePathResolver };
