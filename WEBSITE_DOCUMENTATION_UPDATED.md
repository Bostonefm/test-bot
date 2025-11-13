# Grizzly Bot Documentation

## Overview

**Grizzly Bot** is a unified Discord bot designed for DayZ server management, community engagement, and server administration. It provides real-time server monitoring, player tracking, ticket support system, moderation tools, and Patreon subscription integration—all through Discord slash commands.

### Key Features

- **🎮 DayZ Server Monitoring** - Real-time server status, player tracking, and kill feeds via Nitrado integration
- **🎫 Support Ticket System** - Professional ticket management with priority levels and staff assignments
- **🛡️ Moderation Tools** - Comprehensive moderation with kick, ban, mute, and detailed logging
- **💰 Economy System** - Player rewards, leaderboards, and transaction tracking
- **🔗 Discord Linked Roles** - Automatic Patreon role assignment with one-click verification
- **👥 Patreon Integration** - Subscription tier management and premium features
- **📊 Advanced Analytics** - Channel analytics, player statistics, and server reports
- **🔧 Server Management** - Automated channel setup, permission management, and configuration tools

---

## Getting Started

### Prerequisites

1. **Discord Server** - Administrator permissions required
2. **Patreon Account** (Optional) - For subscription features and Linked Roles
3. **Nitrado Game Server** (Optional) - For DayZ server monitoring

### Bot Invitation

1. Visit our [Bot Invite Page](https://grizzlygaming-gg.com/bot-invite)
2. Select your Discord server from the dropdown
3. Authorize the required permissions
4. The bot will automatically join your server

### Initial Setup

After inviting the bot, use these commands to configure your server:

```
/setup-server - Initialize server configuration
/setup-channels - Create all necessary channels and categories
/setup-rules - Set up rules and verification system
```

---

## Command Categories

### 📋 Server Management

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/setup-server` | Initialize server configuration | Admin |
| `/setup-channels` | Create bot channels automatically | Admin |
| `/register-server` | Register Nitrado server for monitoring | Admin |
| `/server-status` | Check current server status | Everyone |
| `/server-features` | View available server features | Everyone |
| `/update-permissions` | Update role permissions | Admin |

### 🎫 Ticket System

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/ticket-create` | Create a new support ticket | Everyone |
| `/ticket-close` | Close an existing ticket | Staff/Creator |
| `/ticket-list` | View all open tickets | Staff |
| `/ticket-priority` | Set ticket priority level | Staff |
| `/ticket-bulk` | Bulk ticket operations | Admin |
| `/my-server-tickets` | View your submitted tickets | Everyone |

### 🛡️ Moderation

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/kick` | Kick a member from the server | Moderator |
| `/mod-ban` | Ban a member from the server | Moderator |
| `/mod-unban` | Unban a previously banned member | Moderator |
| `/mute` | Mute a member temporarily | Moderator |
| `/mod-logs` | View moderation action logs | Moderator |

### 🎮 DayZ Server Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/nitrado-auth` | Authenticate Nitrado account | Admin |
| `/start-monitoring` | Start real-time server monitoring | Admin |
| `/stop-monitoring` | Stop server monitoring | Admin |
| `/monitoring-status` | Check monitoring status | Admin |
| `/kill-feed` | View recent kill feed | Everyone |
| `/player-list` | View online players | Everyone |
| `/player-stats` | View player statistics | Everyone |
| `/check-online-players` | Check current online players | Everyone |

### 👥 User Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/profile` | View your user profile | Everyone |
| `/link-character` | Link DayZ character to Discord | Everyone |
| `/economy` | View economy stats and balance | Everyone |
| `/apply` | Submit server application | Everyone |
| `/verification-list` | View Patreon verification status | Everyone |

### 📢 Communication

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/announce` | Send server announcement | Admin |
| `/poll` | Create a poll | Moderator |
| `/remind` | Set a reminder | Everyone |
| `/welcome-message` | Configure welcome messages | Admin |

### 🔧 Utility

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/help` | Display all available commands | Everyone |
| `/ping` | Check bot response time | Everyone |
| `/bot-features` | View bot feature list | Everyone |
| `/quick-links` | Access important server links | Everyone |
| `/todo` | Manage your to-do list | Everyone |

### 📊 Analytics & Reports

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/channel-analytics` | View channel usage statistics | Admin |
| `/server-report` | Generate detailed server report | Admin |
| `/log-dashboard` | Access log dashboard | Admin |
| `/role-management` | Manage role assignments | Admin |

---

## Integrations

### 🔗 Discord Linked Roles (NEW!)

**Automatic Patreon verification** with Discord's Linked Roles feature for seamless role assignment:

**How It Works:**
1. Members click **Server Name → Linked Roles** in Discord
2. Select **Grizzly Gaming** from the connections list
3. Authorize with Discord OAuth2
4. Bot automatically assigns your Patreon tier role (Bronze/Silver/Gold)
5. Instant access to premium channels and bot invites

**Benefits:**
- ✅ **One-Click Verification** - No manual buttons or commands needed
- ✅ **Automatic Updates** - Roles update when subscription changes
- ✅ **Secure OAuth2** - Industry-standard Discord authentication
- ✅ **Seamless Experience** - Native Discord integration

**Setup Required (Admins):**
- Create a Linked Role in Server Settings → Roles → Add Verification
- Set criteria based on Patreon tier level
- Members can then connect through Discord's Linked Roles menu

### 👥 Patreon Integration

Connect your Patreon to unlock subscription features:

**Traditional Method:**
1. **Setup**: Use `/send-patreon-verification` to start
2. **Verification**: Members click the verification button
3. **Automatic Roles**: Bot assigns tier-based roles

**Linked Roles Method (Recommended):**
1. **Connect**: Click "Linked Roles" in Discord server menu
2. **Authorize**: Log in through Discord OAuth2
3. **Automatic**: Receive tier role instantly

**Supported Tiers:**
- 🥉 Bronze - Basic premium features
- 🥈 Silver - Advanced features
- 🥇 Gold - All premium features

### 🎮 Nitrado Integration

Monitor your DayZ servers in real-time:

1. **Authentication**: Use `/nitrado-auth` to connect
2. **Server Registration**: Use `/register-server` to add servers
3. **Monitoring**: Use `/start-monitoring` for live updates
4. **Features**:
   - Real-time player join/leave notifications
   - Kill feed with weapon and distance tracking
   - Server status updates
   - Player statistics and leaderboards

---

## Server Configuration

### Required Channels

The bot automatically creates these channels with `/setup-channels`:

**🎫 Ticket System:**
- `#open-a-ticket` - Create support tickets
- `#ticket-log` - Ticket activity log
- `#staff-chat` - Staff coordination

**📢 Information:**
- `#rules` - Server rules and guidelines
- `#welcome` - Welcome messages
- `#announcements` - Server updates

**🎮 Gaming:**
- `#server-status` - DayZ server status
- `#kill-feed` - Real-time kill notifications
- `#player-stats` - Player statistics

### Permission Setup

The bot manages permissions automatically:

- **Admin Roles**: Full access to all commands
- **Moderator Roles**: Moderation and support commands
- **Staff Roles**: Ticket and basic admin tools
- **Member Roles**: Standard user commands
- **Tier Roles**: Premium feature access based on Patreon tier (Bronze/Silver/Gold)

Use `/update-permissions` to refresh permissions after role changes.

---

## Advanced Features

### 🤖 Automated Systems

**Auto-Verification:**
- Automatic Patreon member verification via Linked Roles
- Traditional button-based verification as fallback
- Role assignment based on subscription tier
- Verification reminders and notifications

**Auto-Setup:**
- Automatic channel creation on server join
- Permission configuration
- Welcome message deployment

**Player Tracking:**
- Automatic player status updates
- Online/offline notifications
- Playtime tracking and statistics

### 📈 Analytics Dashboard

Access detailed analytics through commands:

- **Channel Analytics**: Message counts, active users, peak times
- **Player Statistics**: Kills, deaths, playtime, favorite weapons
- **Server Reports**: Uptime, player trends, peak hours
- **Moderation Logs**: Action history, ban statistics

### 🔐 Security Features

- **OAuth2 Authentication**: Secure Discord Linked Roles with CSRF protection
- **Rate Limiting**: Prevents command spam
- **Permission Validation**: Ensures proper role hierarchy
- **Audit Logging**: Tracks all administrative actions
- **Encrypted Storage**: Secure token and credential storage

---

## Troubleshooting

### Common Issues

**❓ Bot Not Responding**
- Check bot is online (green status)
- Verify bot has proper permissions in channel
- Try `/ping` to test connectivity

**❓ Commands Not Showing**
- Re-invite bot with updated permissions
- Check role hierarchy (bot role above managed roles)
- Wait a few minutes for Discord to sync

**❓ Linked Roles Not Working**
- Ensure Linked Roles Verification URL is set in Discord Developer Portal
- Verify OAuth2 redirect URI is configured correctly
- Check that user has active Patreon subscription in database
- Confirm bot has "Manage Roles" permission

**❓ Monitoring Not Working**
- Verify Nitrado authentication (`/nitrado-auth`)
- Check server is registered (`/list-services`)
- Restart monitoring (`/stop-monitoring` then `/start-monitoring`)

**❓ Tickets Not Creating**
- Verify ticket channels exist (`/setup-channels`)
- Check category isn't full (50 channel limit)
- Ensure bot has "Manage Channels" permission

### Getting Support

Need help? Here's how to reach us:

1. **Support Ticket**: Use `/ticket-create` in your server
2. **Discord Server**: Join [Grizzly Gaming Discord](https://discord.gg/grizzlygaming)
3. **Website**: Visit [grizzlygaming-gg.com/support](https://grizzlygaming-gg.com/support)
4. **Documentation**: Check [grizzlygaming-gg.com/docs](https://grizzlygaming-gg.com/docs)

---

## Privacy & Data

### What We Collect

- Discord User IDs and usernames
- Server/Guild IDs and configurations
- Command usage statistics
- Game server player data (when monitoring enabled)
- Patreon subscription status (when linked via Linked Roles or manual verification)
- OAuth2 tokens (temporary, for Linked Roles authentication only)

### What We Don't Collect

- Private messages or DMs
- Message content (except commands)
- Personal information beyond Discord data
- Payment information (handled by Patreon)
- OAuth2 tokens after verification (not stored)

### Data Protection

- All data encrypted at rest
- Secure database connections (SSL/TLS)
- OAuth2 CSRF protection with state validation
- No data sharing with third parties
- GDPR compliant data handling
- Data deletion available on request

---

## Updates & Changelog

### Version 2.1 - Current (October 2025)

**New Features:**
- ✅ **Discord Linked Roles** - Automatic Patreon verification with one-click OAuth2
- ✅ **OAuth2 Security** - CSRF protection and secure cookie handling
- ✅ **Role Metadata System** - Discord role connection metadata for tier verification
- ✅ **Seamless Integration** - Native Discord experience for Patreon verification

### Version 2.0 - Previous

**Major Changes:**
- ✅ Unified bot architecture (merged Assistant Bot)
- ✅ Simplified deployment (single bot, no dashboards)
- ✅ 100 total commands across all categories
- ✅ Improved performance and reliability
- ✅ Enhanced Patreon integration
- ✅ Advanced ticket system with priorities

**Recent Improvements:**
- Real-time WebSocket monitoring for DayZ servers
- Advanced analytics and reporting
- Automated channel and permission management
- Multi-guild support with central command server
- Comprehensive moderation logging

---

## Developer Information

### Technical Stack

- **Runtime**: Node.js (CommonJS)
- **Framework**: Discord.js v14
- **Database**: PostgreSQL (Neon)
- **APIs**: Discord, Patreon, Nitrado
- **Authentication**: Discord OAuth2 with Linked Roles
- **Hosting**: Replit Reserved VM (Production & Development)

### Architecture

- **Bot + OAuth Server**: Dual-process architecture
- **Port 5000**: HTTP server for Linked Roles OAuth callbacks
- **Modular Design**: Clean separation of concerns (/core, /events, /interactions, /services)
- **Security**: CSRF protection, encrypted tokens, secure cookies

### Open Source

Grizzly Bot is developed and maintained by the Grizzly Gaming team. While not open source, we welcome feature requests and bug reports through our support channels.

---

## Credits

**Developed by:** Grizzly Gaming Team  
**Website:** [grizzlygaming-gg.com](https://grizzlygaming-gg.com)  
**Discord:** [Join Our Community](https://discord.gg/grizzlygaming)  
**Patreon:** [Support Us](https://patreon.com/grizzlygaming)

---

## Quick Reference

### Essential Commands

```
/help                    - View all commands
/setup-server           - Initial server setup
/ticket-create          - Create support ticket
/server-status          - Check server status
/profile                - View your profile
/nitrado-auth           - Connect Nitrado account
/start-monitoring       - Start server monitoring
```

### Admin Quick Start

```
1. /setup-server          - Configure bot
2. /setup-channels        - Create channels
3. /setup-rules           - Setup verification
4. /nitrado-auth          - Link game server
5. /register-server       - Add server to monitor
6. /start-monitoring      - Begin monitoring
7. Enable Linked Roles    - Setup automatic Patreon verification
```

### Patreon Verification Methods

**Method 1: Linked Roles (Recommended)**
```
1. Click Server Name (top-left)
2. Select "Linked Roles"
3. Choose "Grizzly Gaming"
4. Authorize with Discord
5. Receive tier role automatically
```

**Method 2: Traditional Verification**
```
1. Admin uses /send-patreon-verification
2. Member clicks verification button
3. Bot checks Patreon subscription
4. Assigns appropriate tier role
```

---

**Need Help?** Use `/help` or create a ticket with `/ticket-create`

**Want Automatic Patreon Roles?** Set up Discord Linked Roles for one-click verification!
