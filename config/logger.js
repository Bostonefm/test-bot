'use strict';
const { createLogger, format, transports } = require('winston');

// ============================================================
// 🪵 Grizzly Bot — Core Logger
// Unified logging system with tagged contexts
// ============================================================

const baseLogger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.Console()
  ],
});

// ------------------------------------------------------------
// Tag helper — returns a wrapped logger that prefixes messages
// ------------------------------------------------------------
baseLogger.tag = (context = 'General') => ({
  info: (msg) => baseLogger.info(`[${context}] ${msg}`),
  warn: (msg) => baseLogger.warn(`[${context}] ${msg}`),
  error: (msg) => baseLogger.error(`[${context}] ${msg}`),
  debug: (msg) => baseLogger.debug(`[${context}] ${msg}`),
  tag: () => baseLogger.tag(context) // chain-safe
});

// ✅ Export the shared logger
module.exports = baseLogger;
