# Grizzly Bot

A comprehensive Discord bot combining DayZ server management, ticketing system, and community moderation tools. Integrates with Nitrado for server management and Patreon for subscription tiers.

## Features

### 🎮 Server Management (via Nitrado)
- Real-time server status monitoring
- Player list and activity tracking
- Log analysis and event detection
- Automated server restart notifications
- Config file monitoring

### 🎫 Ticket System
- Support ticket creation and management
- Priority levels and assignments
- Bulk ticket operations
- User-friendly ticket interface

### 🛡️ Moderation & Administration
- Kick, ban, unban, and mute commands
- Moderation logs and tracking
- Auto-filter for content moderation
- Server announcements and polls
- Reminder and todo systems

### 📊 Economy & Player Tracking
- Player linking and verification
- Economy system with daily rewards
- Leaderboards and transactions
- Player statistics

### 🏢 Multi-Guild Support
- **Grizzly Command Central**: Main administrative server
- **Subscriber Servers**: Individual community servers
- Automatic channel and role setup
- Customizable permission structures

### 💎 Patreon Integration
- Subscription tier management
- Role-based feature access
- Premium server features

## Quick Start

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Database Setup**
   ```bash
   npm run migrate
   ```

3. **Start Bot**
   ```bash
   npm start
   ```

## Key Commands

### Server Management
- `/nitrado-auth` - Connect your Nitrado account
- `/setup-channels` - Set up bot channels and roles
- `/server-status` - Check server status
- `/player-list` - View online players
- `/start-periodic-monitoring` - Begin log monitoring

### Tickets
- `/ticket-create` - Create a support ticket
- `/ticket-close` - Close a ticket
- `/ticket-list` - View all tickets
- `/ticket-priority` - Set ticket priority

### Moderation
- `/mod-ban` - Ban a user
- `/mod-unban` - Unban a user
- `/kick` - Kick a user
- `/mute` - Mute a user
- `/mod-logs` - View moderation logs

### Community
- `/announce` - Make server announcements
- `/poll` - Create a poll
- `/remind` - Set a reminder
- `/help` - Get help with commands

## Architecture

- **Node.js** with Discord.js v14
- **PostgreSQL** database with migrations
- **Winston** logging with structured output
- **Nitrado API** integration with OAuth2
- **Patreon API** for subscription management

## Security

- Environment variables for sensitive data
- Encrypted token storage in database
- Permission-based command access
- Rate limiting for API calls

## External Integrations

This bot connects to:
- **Discord API** - Core bot functionality
- **Nitrado API** - DayZ server management
- **Patreon API** - Subscription and tier management

No web dashboards or external websites - everything managed through Discord commands.

## Development

The bot is designed to be cost-effective and efficient:
- Single Discord bot process (no web servers)
- Respectful API usage with rate limiting
- Intelligent log monitoring without overwhelming external APIs

For detailed project structure, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

---

**Version**: 2.0.0 - Consolidated unified bot
**License**: MIT
**Node.js**: 20+
