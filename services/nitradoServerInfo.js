const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../utils/logger');
const { db } = require('../modules/db');

// Configure retry logic
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           (error.response && error.response.status === 429);
  }
});

/**
 * Fetch game server details from Nitrado API
 * @param {string} serviceId - Nitrado service ID
 * @param {string} accessToken - Nitrado OAuth access token
 * @returns {Promise<object>} - Server details
 */
async function getServerDetails(serviceId, accessToken) {
  try {
    const response = await axios.get(
      `https://api.nitrado.net/services/${serviceId}/gameservers`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 15000
      }
    );

    const gameserver = response.data.data.gameserver;
    
    return {
      status: gameserver.status,
      ip: gameserver.ip,
      port: gameserver.port,
      slots: gameserver.slots,
      game: gameserver.game,
      gameHuman: gameserver.game_human,
      location: gameserver.location,
      currentPlayers: gameserver.query?.player_current || 0,
      maxPlayers: gameserver.query?.player_max || gameserver.slots,
      mapName: gameserver.query?.map || null,
      serverName: gameserver.query?.server_name || null,
      mustWipe: gameserver.must_be_started || false,
      gameSpecific: gameserver.game_specific
    };
  } catch (err) {
    logger.error(`Failed to fetch server details: ${err.message}`);
    throw err;
  }
}

/**
 * Fetch current online players from Nitrado API
 * @param {string} serviceId - Nitrado service ID
 * @param {string} accessToken - Nitrado OAuth access token
 * @returns {Promise<Array>} - Array of online players
 */
async function getOnlinePlayers(serviceId, accessToken) {
  try {
    const response = await axios.get(
      `https://api.nitrado.net/services/${serviceId}/gameservers/games/players`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 15000
      }
    );

    return response.data.data.players || [];
  } catch (err) {
    logger.error(`Failed to fetch online players: ${err.message}`);
    return [];
  }
}

/**
 * Get server restart schedule
 * @param {string} serviceId - Nitrado service ID
 * @param {string} accessToken - Nitrado OAuth access token
 * @returns {Promise<object>} - Restart schedule info
 */
async function getRestartSchedule(serviceId, accessToken) {
  try {
    // Check for auto-restart settings
    const response = await axios.get(
      `https://api.nitrado.net/services/${serviceId}/gameservers/games/settings`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 15000
      }
    );

    const settings = response.data.data.settings;
    
    // Look for restart-related settings
    const autoRestart = settings.find(s => 
      s.key?.toLowerCase().includes('restart') || 
      s.key?.toLowerCase().includes('autorestart')
    );

    return {
      autoRestart: autoRestart?.value || null,
      settings: settings
    };
  } catch (err) {
    logger.error(`Failed to fetch restart schedule: ${err.message}`);
    return null;
  }
}

/**
 * Update guild's map name in database based on server info
 * @param {string} guildId - Discord guild ID
 */
async function updateGuildMapName(guildId) {
  try {
    // Get Nitrado credentials
    const credResult = await db.query(
      `SELECT service_id, encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE guild_id = $1`,
      [guildId]
    );

    if (credResult.rows.length === 0) {
      logger.warn(`No Nitrado credentials found for guild ${guildId}`);
      return null;
    }

    const { service_id, encrypted_token, token_iv, auth_tag } = credResult.rows[0];
    
    // Decrypt the token
    const { decrypt } = require('../utils/encryption');
    const access_token = decrypt(encrypted_token, token_iv, auth_tag);
    
    // Fetch server details
    const serverInfo = await getServerDetails(service_id, access_token);
    
    if (serverInfo.mapName) {
      // Normalize map name
      let mapName = serverInfo.mapName.toLowerCase();
      
      // Handle common map name variations
      if (mapName.includes('chernarus') || mapName.includes('enoch')) {
        mapName = 'chernarus';
      } else if (mapName.includes('livonia')) {
        mapName = 'livonia';
      } else if (mapName.includes('sakhal')) {
        mapName = 'sakhal';
      } else if (mapName.includes('namalsk')) {
        mapName = 'namalsk';
      } else if (mapName.includes('deer') || mapName.includes('isle')) {
        mapName = 'deer-isle';
      } else if (mapName.includes('esseker')) {
        mapName = 'esseker';
      }
      
      // Update database
      await db.query(
        `UPDATE nitrado_credentials SET map_name = $1 WHERE guild_id = $2`,
        [mapName, guildId]
      );
      
      logger.info(`✅ Updated map name to '${mapName}' for guild ${guildId}`);
    }
    
    return serverInfo;
  } catch (err) {
    logger.error(`Failed to update guild map name: ${err.message}`);
    return null;
  }
}

/**
 * Trigger server restart via Nitrado API
 * @param {string} serviceId - Nitrado service ID
 * @param {string} accessToken - Nitrado OAuth access token
 * @returns {Promise<boolean>} - Success status
 */
async function restartServer(serviceId, accessToken) {
  try {
    await axios.post(
      `https://api.nitrado.net/services/${serviceId}/gameservers/restart`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 15000
      }
    );
    
    logger.info(`✅ Server restart initiated for service ${serviceId}`);
    return true;
  } catch (err) {
    logger.error(`Failed to restart server: ${err.message}`);
    return false;
  }
}

module.exports = {
  getServerDetails,
  getOnlinePlayers,
  getRestartSchedule,
  updateGuildMapName,
  restartServer
};
