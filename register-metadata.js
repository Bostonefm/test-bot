/**
 * Register Discord Role Connection Metadata
 * Run this ONCE to register metadata schema with Discord
 * 
 * Usage: node register-metadata.js
 */

const axios = require('axios');
require('dotenv').config();

const DISCORD_CLIENT_ID = process.env.GRIZZLY_BOT_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_BOT_TOKEN = process.env.GRIZZLY_BOT_TOKEN;

async function registerMetadata() {
  try {
    console.log('🔄 Registering Discord Role Connection Metadata...\n');

    // Get bot token (app access token)
    const tokenResponse = await axios.post(
      'https://discord.com/api/v10/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'role_connections.write',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: DISCORD_CLIENT_ID,
          password: DISCORD_CLIENT_SECRET,
        },
      }
    );

    const appAccessToken = tokenResponse.data.access_token;

    // Define metadata schema
    const metadata = [
      {
        key: 'patreon_tier',
        name: 'Patreon Tier',
        description: 'Current Patreon subscription tier',
        type: 7, // STRING_SELECT type
      },
      {
        key: 'subscribed',
        name: 'Active Subscription',
        description: 'Has active Patreon subscription',
        type: 7, // BOOLEAN_EQUAL type (1 or 0)
      },
      {
        key: 'tier_level',
        name: 'Tier Level',
        description: 'Numeric tier level (0=None, 1=Bronze, 2=Silver, 3=Gold)',
        type: 2, // INTEGER_GREATER_THAN_OR_EQUAL type
      },
    ];

    // Register metadata with Discord
    const response = await axios.put(
      `https://discord.com/api/v10/applications/${DISCORD_CLIENT_ID}/role-connections/metadata`,
      metadata,
      {
        headers: {
          Authorization: `Bearer ${appAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Metadata registered successfully!\n');
    console.log('📋 Registered metadata fields:');
    response.data.forEach((field) => {
      console.log(`   • ${field.name} (${field.key}): ${field.description}`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('   1. Go to Discord Developer Portal > Your App > General Information');
    console.log('   2. Set "Linked Roles Verification URL" to your server URL + /linked-role');
    console.log('      Example: https://your-replit-app.repl.co/linked-role');
    console.log('   3. In your Discord server, create a role with Linked Role verification');
    console.log('   4. Set verification criteria using the registered metadata fields');
    console.log('\n✨ Linked Roles setup complete!');
  } catch (error) {
    console.error('❌ Error registering metadata:', error.response?.data || error.message);
    process.exit(1);
  }
}

registerMetadata();
