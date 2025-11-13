# Discord Linked Roles Setup Guide

## Overview

Discord Linked Roles allows your Patreon subscribers to automatically receive tier roles in Grizzly Command Central by connecting their Discord account. This provides seamless access to bot invite links.

## How It Works

1. User subscribes to Grizzly Gaming on Patreon (Bronze/Silver/Gold tier)
2. User joins Grizzly Command Central Discord server
3. User clicks "Linked Roles" in server menu
4. User is redirected to verification URL → logs into Discord OAuth
5. Bot checks Patreon subscription in database
6. Bot assigns appropriate tier role (Bronze/Silver/Gold) in GCC
7. User gains access to bot invite channels automatically

---

## Setup Instructions

### Step 1: Get Required Secrets

You need **2 new secrets** from Discord Developer Portal:

1. Go to: https://discord.com/developers/applications
2. Select your Grizzly Bot application
3. Navigate to **OAuth2 → General**
4. Copy **Client ID** (you already have this as `GRIZZLY_BOT_CLIENT_ID`)
5. Click **Reset Secret** and copy the **Client Secret** → Save as `DISCORD_CLIENT_SECRET`

### Step 2: Add Environment Variables

Add these to your Replit Secrets:

```bash
DISCORD_CLIENT_SECRET=your_client_secret_from_step_1
COOKIE_SECRET=any_random_string_32_characters_minimum
```

Generate a random COOKIE_SECRET:
```bash
# Run this to generate a secure random string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Configure OAuth2 Redirect URI

1. Go to Discord Developer Portal → Your App → **OAuth2 → General**
2. Under **Redirects**, click **Add Redirect**
3. Add your Replit URL + `/discord-callback`:
   ```
   https://your-replit-app-name.repl.co/discord-callback
   ```
4. Click **Save Changes**

### Step 4: Set Linked Roles Verification URL

1. Go to Discord Developer Portal → Your App → **General Information**
2. Find **Linked Roles Verification URL** field
3. Enter your Replit URL + `/linked-role`:
   ```
   https://your-replit-app-name.repl.co/linked-role
   ```
4. Click **Save Changes**

### Step 5: Register Metadata with Discord

Run the registration script **ONE TIME** to register metadata schema:

```bash
node register-metadata.js
```

Expected output:
```
✅ Metadata registered successfully!

📋 Registered metadata fields:
   • Patreon Tier (patreon_tier): Current Patreon subscription tier
   • Active Subscription (subscribed): Has active Patreon subscription
   • Tier Level (tier_level): Numeric tier level (0=None, 1=Bronze, 2=Silver, 3=Gold)
```

### Step 6: Create Linked Role in Discord Server (GCC)

**Admin only, must use Discord Desktop app:**

1. Open **Grizzly Command Central** server
2. Go to **Server Settings → Roles**
3. Click **Create Role**
4. Name it (e.g., "Verified Patreon")
5. Click **Verification** tab
6. Click **Add verification** → Select **Grizzly Gaming** (your bot)
7. Set criteria:
   - **Active Subscription** = 1 (has subscription)
   - OR **Tier Level** ≥ 1 (Bronze or higher)
8. Save the role

### Step 7: Test the Flow

1. Go to your Discord server
2. Click **Server Name** (top-left) → **Linked Roles**
3. Find **Grizzly Gaming** → Click **Connect**
4. Complete OAuth flow
5. Check if you received the tier role

---

## Verification Process

### What Happens During Verification:

```
User clicks "Linked Roles"
    ↓
Redirected to /linked-role endpoint
    ↓
Discord OAuth2 authorization
    ↓
Callback to /discord-callback
    ↓
Bot queries database for Patreon subscription
    ↓
If subscribed: Assign tier role + push metadata
    ↓
User sees success message
```

### Role Assignment Logic:

- **Bronze Patreon** → Bronze Role (ID: 1386839641041543178)
- **Silver Patreon** → Silver Role (ID: 1386839640651145256)
- **Gold Patreon** → Gold Role (ID: 1386839640123887627)
- **No Subscription** → No role, prompted to subscribe

---

## Troubleshooting

### "State verification failed"
- Clear browser cookies and try again
- COOKIE_SECRET must be set in environment variables

### "No active Patreon subscription found"
- Check if user's Discord ID is in `patreon_subscriptions` table
- Verify `active = true` in database record
- Ensure Patreon webhook has synced subscription

### "Role not assigned"
- Check if user is member of Grizzly Command Central
- Verify GRIZZLY_COMMAND_GUILD_ID is set correctly
- Confirm role IDs match your server's actual role IDs

### OAuth Server Not Starting
- Check if PORT 5000 is available
- Verify express and cookie-parser are installed
- Check logs for startup errors

---

## Security Notes

- **CSRF Protection**: State parameter prevents cross-site request forgery
- **Secure Cookies**: HttpOnly and Secure flags in production
- **Token Encryption**: Access tokens are used once and discarded
- **No Token Storage**: OAuth tokens are not stored in database

---

## Endpoints

| Endpoint | Purpose | Method |
|----------|---------|--------|
| `GET /` | Health check | Public |
| `GET /linked-role` | Verification entry point | Public |
| `GET /discord-callback` | OAuth2 callback handler | Internal |

---

## What Users See

### Success (With Subscription):
```
✅ Verification Complete!

Your Patreon subscription has been verified!
You've been assigned your tier role in Grizzly Command Central.

You can now close this window and access bot invite links in Discord.
```

### Success (No Subscription):
```
✅ Verification Complete!

No active Patreon subscription found.
Subscribe at patreon.com/grizzlygaming to unlock benefits!
```

---

## Next Steps After Setup

1. ✅ Test with your own Discord account
2. ✅ Verify role is assigned correctly
3. ✅ Announce feature to community
4. ✅ Update server onboarding to mention Linked Roles
5. ✅ Monitor logs for any OAuth errors

---

## Architecture Changes

**New Files Added:**
- `server.js` - OAuth2 HTTP server for Linked Roles
- `register-metadata.js` - One-time metadata registration script
- `LINKED_ROLES_SETUP.md` - This setup guide

**Modified Files:**
- `app.js` - Now starts both Discord bot + OAuth server
- `.env.example` - Added DISCORD_CLIENT_SECRET and COOKIE_SECRET

**Dependencies Added:**
- `express` - HTTP server framework
- `cookie-parser` - Cookie handling for OAuth state

**Bot Behavior:**
- Discord bot runs as normal
- OAuth server runs on port 5000 alongside bot
- If OAuth server fails, Discord bot continues without Linked Roles
