# Grizzly Bot Documentation

## Overview

**Grizzly Bot** is a unified Discord bot designed for DayZ server management, community engagement, and server administration. It provides real-time server monitoring, player tracking, ticket support system, moderation tools, and Patreon subscription integration—all through Discord slash commands.

### Key Features

- **🎮 DayZ Server Monitoring** - Real-time server status, player tracking, and kill feeds via Nitrado integration
- **🎫 Support Ticket System** - Professional ticket management with priority levels and staff assignments
- **🛡️ Moderation Tools** - Comprehensive moderation with kick, ban, mute, and detailed logging
- **💰 Economy System** - Player rewards, leaderboards, and transaction tracking
- **👥 Patreon Integration** - Automatic subscription tier management and premium features
- **📊 Advanced Analytics** - Channel analytics, player statistics, and server reports
- **🔧 Server Management** - Automated channel setup, permission management, and configuration tools

---

## Getting Started

### Prerequisites

1. **Discord Server** - Administrator permissions required
2. **Patreon Account** (Optional) - For subscription features
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

### 🔗 Patreon Integration

Connect your Patreon to unlock subscription features:

1. **Setup**: Use `/send-patreon-verification` to start
2. **Verification**: Members click the verification button
3. **Automatic Roles**: Bot assigns tier-based roles automatically
4. **Features**: Unlock premium commands and perks per tier

**Supported Tiers:**
- 🥉 Bronze - Basic premium features
- 🥈 Silver - Advanced features
- 🥇 Gold - All premium features
- 💎 Partner - Partner-exclusive features

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
- **Tier Roles**: Premium feature access based on Patreon tier

Use `/update-permissions` to refresh permissions after role changes.

---

## Advanced Features

### 🤖 Automated Systems

**Auto-Verification:**
- Automatic Patreon member verification
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
- Patreon subscription status (when linked)

### What We Don't Collect

- Private messages or DMs
- Message content (except commands)
- Personal information beyond Discord data
- Payment information (handled by Patreon)

### Data Protection

- All data encrypted at rest
- Secure database connections (SSL/TLS)
- No data sharing with third parties
- GDPR compliant data handling
- Data deletion available on request

---

## Updates & Changelog

### Version 2.0 - Current

**Major Changes:**
- ✅ Unified bot architecture (merged Assistant Bot)
- ✅ Simplified deployment (single bot, no dashboards)
- ✅ 96 total commands across all categories
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
- **Hosting**: Railway (Production), Replit (Development)

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
```

---

**Need Help?** Use `/help` or create a ticket with `/ticket-create`
