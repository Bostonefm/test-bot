const logger = require('./logger.js');

const REQUIRED_ENV_VARS = [
  // Discord Bot Configuration
  'GRIZZLY_BOT_TOKEN',
  'GRIZZLY_BOT_CLIENT_ID',

  // Database Configuration
  'DATABASE_URL',

  // Security Keys
  'ENCRYPTION_KEY'
];

const OPTIONAL_ENV_VARS = [
  'PATREON_CLIENT_ID',
  'PATREON_CLIENT_SECRET',
  'PATREON_CAMPAIGN_ID',
  'NITRADO_API_TOKEN',
  'TEST_SERVER_GUILD_ID',
  'GRIZZLY_COMMAND_GUILD_ID'
];

function validateEnvironmentVariables() {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName] || process.env[varName].trim() === '') {
      missing.push(varName);
    }
  }

  // Check optional but recommended variables
  for (const varName of OPTIONAL_ENV_VARS) {
    if (!process.env[varName] || process.env[varName].trim() === '') {
      warnings.push(varName);
    }
  }

  // Report results
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:');
    missing.forEach(varName => {
      logger.error(`   - ${varName}`);
    });
    logger.error('\nPlease check your .env file and ensure all required variables are set.');
    logger.error('Refer to .env.example for the complete list of required variables.');
    process.exit(1);
  }

  if (warnings.length > 0) {
    logger.warn('⚠️  Missing optional environment variables:');
    warnings.forEach(varName => {
      logger.warn(`   - ${varName}`);
    });
    logger.warn('Some features may not work without these variables.');
  }

  logger.info('✅ Environment variable validation passed');

  // Validate specific formats
  validateSpecialFormats();
}

function validateSpecialFormats() {
  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    logger.warn('⚠️  DATABASE_URL should start with "postgresql://"');
  }

  // Validate Discord token format (basic check)
  if (process.env.GRIZZLY_BOT_TOKEN && !process.env.GRIZZLY_BOT_TOKEN.includes('.')) {
    logger.warn('⚠️  GRIZZLY_BOT_TOKEN format appears invalid');
  }

  // Validate client ID format (should be numeric)
  if (process.env.GRIZZLY_BOT_CLIENT_ID && !/^\d+$/.test(process.env.GRIZZLY_BOT_CLIENT_ID)) {
    logger.warn('⚠️  GRIZZLY_BOT_CLIENT_ID should be numeric');
  }

  // Validate encryption key length
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
    logger.warn('⚠️  ENCRYPTION_KEY should be at least 32 characters long');
  }
}

// Environment variable validation utility
function validateEnvironment() {
  const requiredVars = [
    'GRIZZLY_BOT_TOKEN',
    'DATABASE_URL',
    'ENCRYPTION_KEY'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate encryption key format (32 characters minimum for AES-256)
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }

  return true;
}

function logMissingVariables(missingVars) {
  logger.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    logger.error(`   - ${varName}`);
  });
  logger.error('\nPlease check your .env file and ensure all required variables are set.');
  logger.error('Refer to .env.example for the complete list of required variables.');
}

module.exports = { validateEnvironmentVariables, validateEnvironment, logMissingVariables, REQUIRED_ENV_VARS };
