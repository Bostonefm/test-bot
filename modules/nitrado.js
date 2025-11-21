// modules/nitrado.js
const axios = require('axios');
const logger = require('../config/logger.js');

/**
 * Create a Nitrado API helper instance tied to a specific token.
 */
function createNitradoAPI(token) {
  const http = axios.create({
    baseURL: 'https://api.nitrado.net',
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'GrizzlyBot/2.0',
    },
    validateStatus: (s) => s >= 200 && s < 500,
  });

   /* ============================================================
   * 🔍 Auto-detect DayZ log directory
   * Multi-guild safe, but with your known PS4 path first.
   * ============================================================ */
  async function findDayzPath(serviceId) {
    //
    // 0) Known working path for YOUR PS4 server (False Dawn)
    //    Safe for other guilds – if it doesn’t exist, we just skip it.
    //
    const knownPaths = [
      '/games/ni8504127_1/noftp/dayzps/config',
      '/games/ni8504127_1/ftproot/dayzps/config',
    ];

    //
    // 1) Base PS4 folder options
    //
    const baseCandidates = [
      'noftp/dayzps/config',
      'ftproot/dayzps/config',
    ];

    //
    // 2) Dynamic prefixes derived from serviceId
    //    (these help for *other* servers in the future)
    //
    const dynamicPrefixes = [
      `/games/${serviceId}_1/`,
      `/games/${serviceId}/`,
      '/', // root fallback
    ];

    //
    // 3) Build full search list (known paths first!)
    //
    const possiblePaths = [...knownPaths];

    for (const prefix of dynamicPrefixes) {
      for (const base of baseCandidates) {
        possiblePaths.push(prefix + base);
      }
    }

    // absolute fallback paths
    possiblePaths.push('/noftp/dayzps/config');
    possiblePaths.push('/ftproot/dayzps/config');

    logger.info(
      `🔍 [Nitrado] Testing ${possiblePaths.length} possible log paths for service ${serviceId}...`
    );

    //
    // 4) Test each candidate
    //
    for (const p of possiblePaths) {
      try {
        const listing = await listFiles(serviceId, p);
        const entries = listing.data?.entries || listing.entries || [];

        if (!entries.length) continue;

        // Normalize entries
        const normalized = entries.map((f) => ({
          name: f.name || f.filename || '',
          size: f.size || 0,
          modified_at: f.modified_at || f.created_at || 0,
        }));

        // Look for ADM or RPT logs
        const hasLogs = normalized.some((f) =>
          f.name.match(/DayZServer_PS4.*\.(ADM|RPT)$/)
        );

        if (hasLogs) {
          logger.info(`📂 [Nitrado] Found DayZ log directory: ${p}`);
          return p;
        }
      } catch {
        // ignore invalid paths
      }
    }

    logger.warn(`⚠️ [Nitrado] No working DayZ log folder detected for service ${serviceId}`);
    return null;
  }

  /* ============================================================
   * NITRADO BASIC API WRAPPERS
   * ============================================================ */

  async function listServices() {
    const res = await http.get('/services');
    if (res.status !== 200)
      throw new Error(res.data?.message || `HTTP ${res.status}`);
    return res.data;
  }

  async function getServiceInfo(serviceId) {
    const res = await http.get(`/services/${serviceId}`);
    if (res.status !== 200)
      throw new Error(res.data?.message || `HTTP ${res.status}`);
    return res.data;
  }

  async function listFiles(serviceId, path) {
    const res = await http.get(`/services/${serviceId}/gameservers/file_server/list`, {
      params: { directory: path },
    });
    if (res.status !== 200)
      throw new Error(res.data?.message || `HTTP ${res.status}`);
    return res.data;
  }

  async function downloadFile(serviceId, path) {
    const res = await http.get(`/services/${serviceId}/gameservers/file_server/download`, {
      params: { file: path },
      responseType: 'arraybuffer',
    });
    if (res.status !== 200)
      throw new Error(res.data?.message || `HTTP ${res.status}`);
    return Buffer.from(res.data);
  }

  // FINAL export returned
  return {
    listServices,
    getServiceInfo,
    listFiles,
    downloadFile,
    findDayzPath,   // REQUIRED for unified log monitor
  };
}

/**
 * IMPORTANT:
 * Export the function *directly*.
 * This allows:
 *   const createNitradoAPI = require('./nitrado.js')
 * AND
 *   const { createNitradoAPI } = require('./nitrado.js')
 * BOTH to work.
 */
module.exports = createNitradoAPI;
module.exports.createNitradoAPI = createNitradoAPI;


