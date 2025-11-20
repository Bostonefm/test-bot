// modules/nitrado.js
const axios = require('axios');
const logger = require('../config/logger.js');   // <-- REQUIRED

function createNitradoAPI(token) {
  const http = axios.create({
    baseURL: 'https://api.nitrado.net',
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'GrizzlyBot/2.0',
    },
    validateStatus: s => s >= 200 && s < 500,
  });

  /**
   * 🔍 Auto-detect DayZ log directory for a given Nitrado service.
   * Searches all known paths and returns the first one with ADM/RPT logs.
   */
  async function findDayzPath(serviceId) {
    const possiblePaths = [
      '/games/ni8504127_1/noftp/dayzps/config',
      '/games/ni8504127_1/ftproot/dayzps/config',
      '/noftp/dayzps/config',
      '/ftproot/dayzps/config'
    ];

    for (const p of possiblePaths) {
      try {
        const res = await listFiles(serviceId, p);
        const entries = res.data?.entries || [];

        const found = entries.some(f =>
          (f.name || f.filename || '').match(/DayZServer_PS4.*\.(ADM|RPT)$/)
        );

        if (found) {
          logger.info(`📂 [Nitrado] Found DayZ log directory: ${p}`);
          return p;
        }
      } catch (err) {
        // ignore invalid paths silently
      }
    }

    logger.warn(`⚠️ [Nitrado] No working DayZ log folder detected for service ${serviceId}`);
    return null;
  }

  async function listServices() {
    const res = await http.get('/services');
    if (res.status !== 200) throw new Error(res.data?.message || `HTTP ${res.status}`);
    return res.data;
  }

  async function getServiceInfo(serviceId) {
    const res = await http.get(`/services/${serviceId}`);
    if (res.status !== 200) throw new Error(res.data?.message || `HTTP ${res.status}`);
    return res.data;
  }

  async function listFiles(serviceId, path) {
    const res = await http.get(`/services/${serviceId}/gameservers/file_server/list`, {
      params: { directory: path },
    });
    if (res.status !== 200) throw new Error(res.data?.message || `HTTP ${res.status}`);
    return res.data;
  }

  async function downloadFile(serviceId, path) {
    const res = await http.get(`/services/${serviceId}/gameservers/file_server/download`, {
      params: { file: path },
      responseType: 'arraybuffer',
    });
    if (res.status !== 200) throw new Error(res.data?.message || `HTTP ${res.status}`);
    return Buffer.from(res.data);
  }

  // IMPORTANT: expose findDayzPath
  return {
    listServices,
    getServiceInfo,
    listFiles,
    downloadFile,
    findDayzPath      // <-- REQUIRED
  };
}

module.exports = { createNitradoAPI };
