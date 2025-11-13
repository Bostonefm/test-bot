
const logger = require('./logger');

class ErrorRecovery {
  static async withRetry(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        logger.warn(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  static async safeExecute(operation, fallback = null) {
    try {
      return await operation();
    } catch (error) {
      logger.error('Safe execute failed:', error);
      return fallback;
    }
  }
}

module.exports = ErrorRecovery;
