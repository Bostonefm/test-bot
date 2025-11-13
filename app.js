require('dotenv').config();

// Basic process guards
process.on('unhandledRejection', (r) => {
  console.error('[unhandledRejection]', r);
});
process.on('uncaughtException', (e) => {
  console.error('[uncaughtException]', e);
  process.exit(1);
});

// Validate env
try {
  const { validateEnvironmentVariables } = require('./utils/envValidator.js');
  validateEnvironmentVariables();
} catch (e) {
  console.error('Environment validation failed:', e?.message || e);
  process.exit(1);
}

// Start Discord bot (root index.js)
try {
  require('./index.js');
  console.log('Discord bot started successfully.');
} catch (e) {
  console.error('Failed to start Discord bot:', e);
  process.exit(1);
}

// Start OAuth server for Linked Roles (after bot initializes)
setTimeout(async () => {
  try {
    const { startServer } = require('./server.js');
    await startServer();
    console.log('✅ Linked Roles OAuth server started successfully.');
  } catch (e) {
    console.error('⚠️  Failed to start OAuth server:', e);
    console.log('Discord bot will continue running without Linked Roles.');
  }
}, 2000); // Wait 2s for bot to initialize

console.log('Grizzly Bot bootstrap complete.');
