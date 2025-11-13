const axios = require('axios');
const path = require('path');
const logger = require('../utils/logger.js');

/**
 * @typedef {Object} FileEntry
 * @property {string} name - File name
 * @property {string} type - File type ('file' or 'dir')
 * @property {number} size - File size in bytes
 * @property {string} last_modified - Last modification timestamp
 */

/**
 * 🧩 Nitrado File Operations Module
 * Handles file listing, downloading, uploading, and directory operations safely
 */
class NitradoFiles {
  /**
   * @param {string} token - Nitrado API token
   * @param {string} [baseURL='https://api.nitrado.net'] - API base URL
   * @param {Function} [executeWithBackoff] - Rate limit handler (optional)
   */
  constructor(token, baseURL = 'https://api.nitrado.net', executeWithBackoff) {
    this.token = token;
    this.baseURL = baseURL;

    // ✅ Auto-bind fallback to prevent undefined.bind crashes
    this.executeWithBackoff =
      typeof executeWithBackoff === 'function'
        ? executeWithBackoff.bind?.(this) || executeWithBackoff
        : async (fn) => {
            try {
              return await fn();
            } catch (err) {
              logger.error('⚠️ [NitradoFiles] Request failed without rate limiter:', err.message);
              throw err;
            }
          };
  }

  /**
   * Centralized file request method
   */
  async fileRequest(method, endpoint, options = {}, rateLimitKey = null) {
    const { params, data, headers = {}, responseType = 'json', timeout = 30000 } = options;
    const rateLimitEndpoint = rateLimitKey || endpoint.split('?')[0];

    const config = {
      method: method.toUpperCase(),
      url: endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GrizzlyBot/1.0',
        ...headers,
      },
      timeout,
      responseType,
    };

    if (params) config.params = params;
    if (data) config.data = data;

    return await this.executeWithBackoff(() => axios(config), rateLimitEndpoint)
      .then((response) => {
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return responseType === 'json' ? response.data : response;
      })
      .catch((error) => {
        let errorMessage = 'Unknown error occurred';
        let statusCode = null;

        if (error.response) {
          statusCode = error.response.status;
          errorMessage =
            error.response.data?.message ||
            error.response.data?.error ||
            error.response.statusText ||
            `HTTP ${statusCode} Error`;
        } else if (error.request) {
          errorMessage = 'Network error - no response received';
        } else {
          errorMessage = error.message;
        }

        logger.error(`Nitrado File Request Failed: ${method.toUpperCase()} ${endpoint}`, {
          status: statusCode,
          message: errorMessage,
          endpoint: rateLimitEndpoint,
        });

        const normalizedError = new Error(errorMessage);
        normalizedError.status = statusCode;
        normalizedError.endpoint = endpoint;
        normalizedError.originalError = error;
        throw normalizedError;
      });
  }

  /**
   * Validate and normalize API paths to prevent directory traversal
   */
  validateApiPath(inputPath) {
    if (typeof inputPath !== 'string') throw new Error('Path must be a string');
    if (inputPath.includes('\0') || inputPath.includes('\x00')) throw new Error('Path contains null bytes');

    let normalizedPath = path.posix.normalize(inputPath);
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) throw new Error('Path contains directory traversal sequences');
    if (normalizedPath.startsWith('../') || normalizedPath === '..') throw new Error('Path attempts to escape base directory');

    if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
    if (normalizedPath !== '/' && normalizedPath.endsWith('/')) normalizedPath = normalizedPath.replace(/\/+$/, '');

    const suspiciousPatterns = [/\.\./, /\/\.\//, /\/\/+/, /[<>"|?*]/, /[\x00-\x1f]/];
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(normalizedPath)) throw new Error(`Path contains suspicious pattern: ${pattern.source}`);
    }

    logger.debug(`Path validated and normalized: '${inputPath}' -> '${normalizedPath}'`);
    return normalizedPath;
  }

  /**
   * List files in directory with pagination support
   */
  async listFiles(serviceId, path = '/', fetchAll = true, maxPages = 50) {
    let normalizedPath = this.validateApiPath(path);
    let allEntries = [];
    let currentPage = 1;
    let totalPages = 1;
    let pagesProcessed = 0;

    do {
      const params = { dir: normalizedPath, page: currentPage };
      logger.debug(`Fetching page ${currentPage} for path: ${normalizedPath}`);

      const response = await this.fileRequest(
        'GET',
        `/services/${serviceId}/gameservers/file_server/list`,
        { params },
        `list-files-${serviceId}-page-${currentPage}`
      );

      const responseData = response.data || response;
      const entries = responseData.entries || [];

      if (entries.length > 0) {
        allEntries = allEntries.concat(entries);
        logger.debug(`Added ${entries.length} entries from page ${currentPage}`);
      }

      const paginationInfo = responseData.pagination || responseData.meta || {};
      if (paginationInfo.total_pages !== undefined) totalPages = paginationInfo.total_pages;
      else if (paginationInfo.totalPages !== undefined) totalPages = paginationInfo.totalPages;
      else if (paginationInfo.last_page !== undefined) totalPages = paginationInfo.last_page;

      const hasNextPage =
        paginationInfo.has_next_page ||
        paginationInfo.hasNextPage ||
        currentPage < totalPages ||
        (entries.length > 0 && entries.length >= (paginationInfo.per_page || 100));

      pagesProcessed++;
      currentPage++;

      if (!fetchAll || pagesProcessed >= maxPages || entries.length === 0) break;
      if (hasNextPage && currentPage <= totalPages) await this.sleep(100);
    } while (fetchAll && currentPage <= totalPages && pagesProcessed < maxPages);

    logger.info(
      `Fetched ${allEntries.length} total entries from ${pagesProcessed} pages for path: ${normalizedPath}`
    );

    return {
      data: {
        entries: allEntries,
        pagination: {
          current_page: 1,
          total_pages: pagesProcessed,
          total_entries: allEntries.length,
          fetched_all_pages: pagesProcessed < maxPages,
        },
      },
    };
  }

  /** Download file */
  async downloadFile(serviceId, filePath) {
    const normalizedPath = this.validateApiPath(filePath);
    try {
      const tokenResponse = await this.fileRequest(
        'GET',
        `/services/${serviceId}/gameservers/file_server/download`,
        { params: { file: normalizedPath } },
        `download-file-${serviceId}`
      );

      if (tokenResponse.data?.token?.url) {
        const downloadUrl = tokenResponse.data.token.url;
        const fileResponse = await this.fileRequest('GET', downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
        });
        return Buffer.from(fileResponse.data);
      }
      return Buffer.from(tokenResponse);
    } catch (error) {
      throw new Error(`Failed to download file ${normalizedPath} for service ${serviceId}: ${error.message}`);
    }
  }

  /** Upload file */
  async uploadFile(serviceId, filePath, content) {
    const normalizedPath = this.validateApiPath(filePath);
    const formData = new FormData();
    formData.append('path', normalizedPath);
    formData.append('file', new Blob([content]));

    return await this.fileRequest('POST', `/services/${serviceId}/gameservers/file_server/upload`, {
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  /** Delete file */
  async deleteFile(serviceId, filePath) {
    const normalizedPath = this.validateApiPath(filePath);
    return await this.fileRequest('DELETE', `/services/${serviceId}/gameservers/file_server/delete`, {
      params: { path: normalizedPath },
    });
  }

  /** Directory info */
  async getDirectoryInfo(serviceId, path = '/') {
    const response = await this.listFiles(serviceId, path, false);
    const entries = response.data?.entries || [];
    const paginationInfo = response.data?.pagination || {};

    return {
      path,
      firstPageEntries: entries.length,
      totalPages: paginationInfo.total_pages || 1,
      hasMultiplePages: (paginationInfo.total_pages || 1) > 1,
      estimatedTotalFiles: paginationInfo.total_entries || entries.length,
      sampleEntries: entries.slice(0, 5),
    };
  }

  /** Read file incrementally */
  async readFileFromPosition(serviceId, filePath, position = 0) {
    try {
      const fileBuffer = await this.downloadFile(serviceId, filePath);
      const fullContent = fileBuffer.toString('utf8');
      if (position >= fullContent.length)
        return { success: true, content: '', newPosition: fullContent.length };
      return {
        success: true,
        content: fullContent.substring(position),
        newPosition: fullContent.length,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { NitradoFiles };
