const winston = require('winston');

// Helper function to safely stringify objects, handling circular references
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, val) => {
    if (val != null && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  });
}

// Create winston logger with optimized console transport
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length) {
        try {
          metaStr = ` ${safeStringify(meta)}`;
        } catch (error) {
          metaStr = ` [Logging Error: ${error.message}]`;
        }
      }
      return `${timestamp} ${level}: ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
});

// Retry wrapper for Nitrado API calls
const retryNitradoCall = async (fn, description, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error(`${description} failed after ${maxRetries} attempts:`, error);
        throw error;
      }
      logger.warn(`${description} attempt ${attempt} failed, retrying...`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
};

// CommonJS exports
module.exports = {
  debug: (...args) => logger.debug(...args),
  info: (...args) => logger.info(...args),
  warn: (...args) => logger.warn(...args),
  error: (...args) => logger.error(...args),
  retryNitradoCall
};
