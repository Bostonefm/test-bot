const { Pool, Client } = require('pg');
const logger = require('../config/logger.js');
const { decrypt } = require("../utils/encryption.js");
const dotenv = require('dotenv');
dotenv.config();

// Ensure encryption key is properly set
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  logger.warn('ENCRYPTION_KEY is missing or too short - using fallback (not recommended for production)');
}

// Database pool configuration with gentle defaults
const MAX = Number(process.env.DB_POOL_MAX || 3);
const IDLE = Number(process.env.DB_POOL_IDLE || 10000);
const TIMEOUT = Number(process.env.DB_POOL_TIMEOUT || 5000);

const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  max: MAX,
  idleTimeoutMillis: IDLE,
  connectionTimeoutMillis: TIMEOUT,
};

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.client = null;
    this.isConnected = false;
  }

  // Initialize connection pool (recommended for most use cases)
  async initializePool() {
    if (this.pool && !this.pool.ended) {
      return this.pool;
    }

    try {
      // Use pooled connection string for better performance
      const connectionString = process.env.DATABASE_URL;
      const pooledConnectionString = connectionString.includes('-pooler')
        ? connectionString
        : connectionString.replace(/\.([^.]+)\./, '-pooler.$1.');

      this.pool = new Pool({
        connectionString: pooledConnectionString,
        max: 5, // Further reduced for Replit
        min: 0, // Allow pool to scale down completely
        idleTimeoutMillis: 30000, // Shorter idle timeout
        connectionTimeoutMillis: 15000, // Longer connection timeout
        maxUses: 1000, // Reduced max uses per connection
        acquireTimeoutMillis: 15000, // Longer acquire timeout
        statement_timeout: 45000, // Longer statement timeout
        query_timeout: 45000,
        // Handle connection issues gracefully
        ssl: { rejectUnauthorized: false },
      });

      // Test the connection with retry logic
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const testClient = await this.pool.connect();
          await testClient.query('SELECT NOW()');
          testClient.release();
          break; // Success, exit retry loop
        } catch (testError) {
          retryCount++;
          logger.warn(
            `Database connection test failed (attempt ${retryCount}/${maxRetries}):`,
            testError.message
          );

          if (retryCount >= maxRetries) {
            throw testError;
          }

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }

      this.isConnected = true;
      logger.info('Database pool initialized successfully');

      // Handle pool errors with reconnection
      this.pool.on('error', err => {
        logger.error('Pool error occurred:', err.message);
        this.isConnected = false;

        // Attempt to recreate pool after error
        setTimeout(() => {
          this.pool = null;
          this.initializePool().catch(reconnectErr => {
            logger.error('Failed to reconnect after pool error:', reconnectErr.message);
          });
        }, 5000);
      });

      // Handle client connection errors
      this.pool.on('connect', client => {
        client.on('error', err => {
          logger.error('Client connection error:', err.message);
        });
      });

      return this.pool;
    } catch (error) {
      logger.error('Failed to initialize database pool:', error);
      throw error;
    }
  }

  // Get a client from the pool
  async getClient() {
    if (!this.pool) {
      await this.initializePool();
    }
    return this.pool.connect();
  }

  // Execute a query with automatic client management and retry logic
  async query(text, params, retryCount = 0) {
    const maxRetries = 3;

    try {
      if (!this.pool || this.pool.ended) {
        await this.initializePool();
      }

      const client = await this.pool.connect();
      try {
        const result = await client.query(text, params);
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      const isConnectionError =
        error.message.includes('Connection terminated') ||
        error.message.includes('connect ECONNREFUSED') ||
        error.message.includes('connection timeout') ||
        error.code === 'ECONNRESET';

      if (isConnectionError && retryCount < maxRetries) {
        logger.warn(
          `Database query failed (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`,
          error.message
        );

        // Reset pool on connection errors
        this.pool = null;
        this.isConnected = false;

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));

        return this.query(text, params, retryCount + 1);
      }

      logger.error('Database query error:', error);
      throw error;
    }
  }

  // Execute multiple queries in a transaction
  async transaction(queries) {
    if (!this.pool) {
      await this.initializePool();
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const results = [];
      for (const { text, params } of queries) {
        const result = await client.query(text, params);
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Initialize a single client connection (for specific use cases)
  async initializeClient() {
    if (this.client && !this.client._ending) {
      return this.client;
    }

    try {
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
      });

      await this.client.connect();

      // Test the connection
      await this.client.query('SELECT NOW()');

      this.isConnected = true;
      logger.info('Database client connected successfully');

      // Handle client errors
      this.client.on('error', err => {
        logger.error('Database client error:', err);
        this.isConnected = false;
      });

      return this.client;
    } catch (error) {
      logger.error('Failed to connect database client:', error);
      throw error;
    }
  }

  // Close all connections
  async close() {
    try {
      if (this.pool && !this.pool.ended) {
        await this.pool.end();
        this.pool = null;
        logger.info('Database pool closed');
      }

      if (this.client && !this.client._ending) {
        await this.client.end();
        this.client = null;
        logger.info('Database client closed');
      }

      this.isConnected = false;
    } catch (error) {
      logger.error('Error closing database connections:', error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.pool) {
        await this.initializePool();
      }

      const result = await this.query('SELECT NOW() as current_time');
      return {
        status: 'healthy',
        timestamp: result.rows[0].current_time,
        connected: this.isConnected,
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false,
      };
    }
  }

  // Utility methods for common operations
  async getGuildSubscription(guildId) {
    const result = await this.query('SELECT * FROM guild_subscriptions WHERE guild_id = $1', [
      guildId,
    ]);
    return result.rows[0] || null;
  }

  async setFeatureFlag(guildId, flagName, flagValue) {
    await this.query('SELECT set_feature_flag($1, $2, $3)', [guildId, flagName, flagValue]);
  }

  async getFeatureFlag(guildId, flagName) {
    const result = await this.query('SELECT get_feature_flag($1, $2) as flag_value', [
      guildId,
      flagName,
    ]);
    return result.rows[0]?.flag_value || false;
  }

  // Get Nitrado credentials for a Discord user
  async getNitradoCreds(discordId) {
    const result = await this.query(
      'SELECT encrypted_token, token_iv, auth_tag, service_id FROM nitrado_credentials WHERE discord_id = $1',
      [discordId]
    );
    return result.rows[0] || null;
  }

  // Get Nitrado credentials for a guild
  async getNitradoCredsByGuild(guildId) {
    const result = await this.query(
      'SELECT encrypted_token, token_iv, auth_tag, service_id FROM nitrado_credentials WHERE guild_id = $1',
      [guildId]
    );
    return result.rows[0] || null;
  }

  // Get all unique service IDs for monitoring
  async getAllNitradoServices() {
    const result = await this.query(
      'SELECT DISTINCT service_id, encrypted_token as api_token FROM nitrado_credentials WHERE service_id IS NOT NULL'
    );
    return result.rows;
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

// Legacy client for backward compatibility
let legacyClient = null;

// Initialize legacy client on first access
async function getLegacyClient() {
  if (!legacyClient || legacyClient._ending) {
    legacyClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await legacyClient.connect();

    legacyClient.on('error', err => {
      logger.error('Legacy database client error:', err);
    });
  }
  return legacyClient;
}

// Initialize database function (might be used elsewhere or for specific setup)
async function initializeDatabase() {
  // This could be used for more complex initialization if needed,
  // but currently `initializePool` is called on module load.
  // For now, it just ensures the pool is initialized.
  await dbManager.initializePool();
  await getLegacyClient(); // Ensure legacy client is also ready if used
}

// Test connection function
async function testConnection() {
  try {
    await dbManager.initializePool(); // Ensure pool is initialized
    const health = await dbManager.healthCheck();
    if (health.status !== 'healthy') {
      throw new Error(`Database health check failed: ${health.error}`);
    }
    return { success: true, message: 'Database connection successful' };
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return { success: false, message: error.message };
  }
}


// Auto-initialize pool on module load
dbManager.initializePool().catch(err => {
  logger.error('Failed to auto-initialize database pool:', err);
});

// Export pool after initialization
let poolInstance = null;

const getPool = async () => {
  if (!poolInstance) {
    poolInstance = await dbManager.initializePool();
  }
  return poolInstance;
};

// Track if shutdown has been initiated
let shutdownInitiated = false;

// Graceful shutdown handling
const gracefulShutdown = async signal => {
  if (shutdownInitiated) {
    return;
  }
  shutdownInitiated = true;

  logger.info(`Received ${signal}, closing database connections...`);
  await dbManager.close();
  if (legacyClient && !legacyClient._ending) {
    await legacyClient.end();
  }
};

/** Resolve Nitrado credentials with env fallback + DB lookup */
async function getNitradoCreds({ discordId } = {}) {
  if (process.env.NITRADO_TOKEN) return { token: process.env.NITRADO_TOKEN };
  if (!discordId) return {};
  const r = await dbManager.query(
    `SELECT encrypted_token, token_iv, auth_tag, service_id
       FROM nitrado_credentials
      WHERE discord_id = $1
      LIMIT 1`,
    [discordId]
  );
  const row = r?.rows?.[0];
  if (!row) return {};
  const token = decrypt(row.encrypted_token, row.token_iv, row.auth_tag);
  return token ? { token, serviceId: row.service_id } : {};
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Export database manager and utility functions
module.exports = {
  db: dbManager,
  dbManager,
  getPool,
  getNitradoCreds,
  DatabaseManager
};
