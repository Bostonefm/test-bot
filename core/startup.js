const dotenv = require('dotenv');
const { createClient } = require('./client.js');
const { loadCommands } = require('./commandLoader.js');
const { registerCommands } = require('../utils/commandRegistrar.js');
const { validateEnvironmentVariables } = require('../utils/envValidator.js');
const logger = require('../config/logger.js');

// Load environment variables
dotenv.config();

// Validate environment variables before proceeding
validateEnvironmentVariables();

/**
 * Initialize and start the Discord bot
 */
let botStartCount = 0;
async function startBot() {
  botStartCount++;
  console.log(`⚠️  startBot() called ${botStartCount} times`);
  
  // Console clear on startup
  console.clear();
  console.log('\n'.repeat(5));
  console.log('🔄 RESTARTING BOT - CONSOLE CLEARED');
  console.log('=====================================\n');

  // Create Discord client
  const client = createClient();

  // Make client globally accessible (for API server compatibility)
  global.client = client;

  // Load all commands
  const commands = loadCommands(client);

  // Register commands with Discord ONLY if REGISTER_COMMANDS=true
  // Set REGISTER_COMMANDS=true only when adding/updating commands, not on every restart
  if (process.env.REGISTER_COMMANDS === 'true') {
    try {
      const DEV_GUILD_ID = process.env.DEV_GUILD_ID || '';

      const result = await registerCommands({
        clientId: process.env.GRIZZLY_BOT_CLIENT_ID,
        token: process.env.GRIZZLY_BOT_TOKEN,
        commands,
        devGuildId: DEV_GUILD_ID
      });

      logger.info(`✅ Registered ${commands.length} commands (${result.scope}${result.guildId ? `:${result.guildId}` : ''})`);
      logger.warn('⚠️ REGISTER_COMMANDS=true - Set to false after verifying commands work!');
    } catch (error) {
      logger.error('Error registering commands:', error);
    }
  } else {
    logger.info(`Skipped command registration (${commands.length} commands loaded). Set REGISTER_COMMANDS=true to register.`);
  }

  // Load event handlers
  console.log(`📊 Before loading handlers: interactionCreate listeners = ${client.listenerCount('interactionCreate')}`);
  require('../events/ready.js')(client);
  require('../events/guildCreate.js')(client);
  require('../events/guildMemberAdd.js')(client);
  require('../events/interactionCreate.js')(client);
  console.log(`📊 After loading handlers: interactionCreate listeners = ${client.listenerCount('interactionCreate')}`);

  // Load global error handlers
  require('./errorHandlers.js')(client);

  // Start the bot
  try {
    const { db } = require('../modules/db.js');
    await db.query('SELECT 1');
    logger.info('Database connection successful');

    await client.login(process.env.GRIZZLY_BOT_TOKEN);
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }

  return client;
}

module.exports = { startBot };
