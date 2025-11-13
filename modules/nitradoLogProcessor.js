
const logger = require('../utils/logger.js');

class NitradoLogProcessor {
  constructor() {
    this.importantMessages = [
      'server restart',
      'crash',
      'error',
      'warning',
      'maintenance',
      'update',
      'backup',
      'disk space',
      'memory',
      'cpu',
    ];
  }

  /**
   * Process Nitrado system logs and extract important events
   * @param {Array} logs - Array of log objects from Nitrado API
   * @param {string} serviceId - Service ID
   * @returns {Array} Processed events for notification system
   */
  processSystemLogs(logs, serviceId) {
    const events = [];

    for (const log of logs) {
      const event = this.convertLogToEvent(log, serviceId);
      if (event) {
        events.push(event);
      }
    }

    logger.info(`🔄 Processed ${events.length} Nitrado system events from ${logs.length} logs`);
    return events;
  }

  /**
   * Convert a Nitrado log entry to a standardized event
   * @param {Object} log - Nitrado log object
   * @param {string} serviceId - Service ID
   * @returns {Object|null} Standardized event object
   */
  convertLogToEvent(log, serviceId) {
    const message = log.message.toLowerCase();
    const isImportant = this.importantMessages.some(keyword => message.includes(keyword));

    // Only process important events to avoid spam
    if (!isImportant && log.severity === 'info') {
      return null;
    }

    const event = {
      type: this.determineEventType(log),
      timestamp: new Date(log.created_at),
      serviceId: serviceId,
      source: 'nitrado_system',
      severity: log.severity,
      category: log.category,
      message: log.message,
      user: log.user,
      isAdmin: log.admin,
      raw: log,
    };

    // Add specific data based on event type
    if (event.type === 'server_restart') {
      event.restartBy = log.user;
      event.isAdminRestart = log.admin;
    } else if (event.type === 'system_error') {
      event.priority = 'high';
    } else if (event.type === 'system_warning') {
      event.priority = 'medium';
    }

    return event;
  }

  /**
   * Determine event type from log content
   * @param {Object} log - Nitrado log object
   * @returns {string} Event type
   */
  determineEventType(log) {
    const message = log.message.toLowerCase();

    if (message.includes('restart')) {
      return 'server_restart';
    } else if (message.includes('crash') || message.includes('crashed')) {
      return 'server_crash';
    } else if (message.includes('start') && message.includes('server')) {
      return 'server_start';
    } else if (message.includes('stop') && message.includes('server')) {
      return 'server_stop';
    } else if (message.includes('backup')) {
      return 'backup_event';
    } else if (message.includes('update') || message.includes('upgrade')) {
      return 'server_update';
    } else if (message.includes('maintenance')) {
      return 'maintenance';
    } else if (log.severity === 'error') {
      return 'system_error';
    } else if (log.severity === 'warning') {
      return 'system_warning';
    } else if (log.admin) {
      return 'admin_action';
    } else {
      return 'system_info';
    }
  }

  /**
   * Filter logs by time range and importance
   * @param {Array} logs - Array of log objects
   * @param {number} hours - Hours to look back
   * @param {boolean} importantOnly - Only return important events
   * @returns {Array} Filtered logs
   */
  filterLogs(logs, hours = 24, importantOnly = false) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    return logs.filter(log => {
      const logTime = new Date(log.created_at);

      // Time filter
      if (logTime < cutoffTime) {
        return false;
      }

      // Importance filter
      if (importantOnly) {
        const message = log.message.toLowerCase();
        return (
          this.importantMessages.some(keyword => message.includes(keyword)) ||
          log.severity !== 'info'
        );
      }

      return true;
    });
  }

  /**
   * Get log statistics
   * @param {Array} logs - Array of log objects
   * @returns {Object} Statistics object
   */
  getLogStatistics(logs) {
    const stats = {
      total: logs.length,
      categories: {},
      severities: {},
      adminActions: 0,
      restarts: 0,
      errors: 0,
      warnings: 0,
      timeRange: {
        oldest: null,
        newest: null,
      },
    };

    for (const log of logs) {
      // Categories
      stats.categories[log.category] = (stats.categories[log.category] || 0) + 1;

      // Severities
      stats.severities[log.severity] = (stats.severities[log.severity] || 0) + 1;

      // Special counts
      if (log.admin) {
        stats.adminActions++;
      }
      if (log.message.toLowerCase().includes('restart')) {
        stats.restarts++;
      }
      if (log.severity === 'error') {
        stats.errors++;
      }
      if (log.severity === 'warning') {
        stats.warnings++;
      }

      // Time range
      const logTime = new Date(log.created_at);
      if (!stats.timeRange.oldest || logTime < stats.timeRange.oldest) {
        stats.timeRange.oldest = logTime;
      }
      if (!stats.timeRange.newest || logTime > stats.timeRange.newest) {
        stats.timeRange.newest = logTime;
      }
    }

    return stats;
  }

  /**
   * Check for concerning patterns in logs
   * @param {Array} logs - Array of log objects
   * @returns {Array} Array of detected issues
   */
  detectIssues(logs) {
    const issues = [];
    const stats = this.getLogStatistics(logs);

    // High error rate
    if (stats.errors > 10) {
      issues.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `High error rate detected: ${stats.errors} errors`,
        count: stats.errors,
      });
    }

    // Frequent restarts
    if (stats.restarts > 5) {
      issues.push({
        type: 'frequent_restarts',
        severity: 'warning',
        message: `Frequent server restarts: ${stats.restarts} restarts`,
        count: stats.restarts,
      });
    }

    // Many warnings
    if (stats.warnings > 20) {
      issues.push({
        type: 'high_warning_count',
        severity: 'warning',
        message: `High warning count: ${stats.warnings} warnings`,
        count: stats.warnings,
      });
    }

    return issues;
  }
}

module.exports = { NitradoLogProcessor };
