const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const axios = require('axios');
const { db } = require('./modules/db.js');
const logger = require('./config/logger.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cookieParser(process.env.COOKIE_SECRET || crypto.randomUUID()));
app.use(express.json());

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.GRIZZLY_BOT_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/discord-callback`
  : 'http://localhost:5000/discord-callback';

/**
 * Health check endpoint
 */
app.get('/', (req, res) => {
  res.send('Grizzly Bot OAuth Server - Linked Roles Active');
});

/**
 * Linked Roles Verification URL - Entry point for Discord Linked Roles
 */
app.get('/linked-role', (req, res) => {
  try {
    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    res.cookie('clientState', state, { 
      maxAge: 1000 * 60 * 5, // 5 minutes
      signed: true,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    // Build Discord OAuth2 authorization URL
    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', DISCORD_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify guilds.join role_connections.write');
    url.searchParams.set('state', state);

    logger.info('Linked Role verification initiated');
    res.redirect(url.toString());
  } catch (error) {
    logger.error('Error in /linked-role:', error);
    res.status(500).send('Failed to initiate verification');
  }
});

/**
 * Discord OAuth2 Callback - Handles user after Discord authorization
 */
app.get('/discord-callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.signedCookies?.clientState;

    // Verify state to prevent CSRF attacks - both must exist and match
    if (!state || !storedState) {
      logger.warn('OAuth callback missing state parameter or cookie');
      return res.status(403).send('Invalid request - CSRF validation failed');
    }

    if (state !== storedState) {
      logger.warn('State mismatch in OAuth callback');
      return res.status(403).send('State verification failed');
    }

    // Clear the state cookie after validation (one-time use)
    res.clearCookie('clientState');

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://discord.com/api/v10/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user info from Discord
    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const discordUser = userResponse.data;
    const userId = discordUser.id;

    // Check Patreon subscription in database
    const subscriptionResult = await db.query(
      'SELECT subscription_tier, active FROM patreon_subscriptions WHERE discord_id = $1 AND active = true',
      [userId]
    );

    let metadata = {};
    let roleAssigned = false;

    if (subscriptionResult.rows.length > 0) {
      const subscription = subscriptionResult.rows[0];
      const tier = subscription.subscription_tier;

      // Set metadata based on Patreon tier
      metadata = {
        patreon_tier: tier,
        subscribed: 1,
        tier_level: tier === 'Gold' ? 3 : tier === 'Silver' ? 2 : 1,
      };

      // Assign role in GCC server
      const gccGuildId = process.env.GRIZZLY_COMMAND_GUILD_ID;
      if (gccGuildId && global.client) {
        const tierRoles = {
          Bronze: '1386839641041543178',
          Silver: '1386839640651145256',
          Gold: '1386839640123887627',
        };

        const roleId = tierRoles[tier];
        if (roleId) {
          try {
            const guild = global.client.guilds.cache.get(gccGuildId);
            if (guild) {
              const member = await guild.members.fetch(userId);
              const role = guild.roles.cache.get(roleId);
              if (member && role) {
                await member.roles.add(role);
                roleAssigned = true;
                logger.info(`Assigned ${tier} role to user ${userId} via Linked Roles`);
              }
            }
          } catch (error) {
            logger.error(`Error assigning role to ${userId}:`, error);
          }
        }
      }
    } else {
      // No active subscription
      metadata = {
        patreon_tier: 'None',
        subscribed: 0,
        tier_level: 0,
      };
    }

    // Push metadata to Discord
    await axios.put(
      `https://discord.com/api/v10/users/@me/applications/${DISCORD_CLIENT_ID}/role-connection`,
      {
        platform_name: 'Grizzly Gaming Patreon',
        metadata: metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Success response
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Grizzly Gaming - Linked Roles</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            max-width: 500px;
          }
          .success { color: #4ade80; }
          .info { color: #60a5fa; }
          h1 { margin-bottom: 20px; }
          p { font-size: 18px; line-height: 1.6; }
          a { color: #60a5fa; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Verification Complete!</h1>
          ${roleAssigned ? `
            <p class="success">Your Patreon subscription has been verified!</p>
            <p class="info">You've been assigned your tier role in Grizzly Command Central.</p>
            <p>You can now close this window and access bot invite links in Discord.</p>
          ` : subscriptionResult.rows.length > 0 ? `
            <p class="info">Your Patreon subscription has been verified!</p>
            <p>Please make sure you're a member of Grizzly Command Central to receive your role.</p>
          ` : `
            <p class="info">No active Patreon subscription found.</p>
            <p>Subscribe at <a href="https://patreon.com/grizzlygaming" target="_blank">patreon.com/grizzlygaming</a> to unlock benefits!</p>
          `}
        </div>
      </body>
      </html>
    `);

    logger.info(`Linked Roles verification complete for user ${userId}`);
  } catch (error) {
    logger.error('Error in /discord-callback:', error);
    res.status(500).send('Verification failed. Please try again.');
  }
});

/**
 * Start the OAuth server
 */
function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`OAuth server listening on port ${PORT}`);
      logger.info(`Linked Roles Verification URL: ${DISCORD_REDIRECT_URI.replace('/discord-callback', '/linked-role')}`);
      resolve(server);
    });
  });
}

module.exports = { startServer, app };
