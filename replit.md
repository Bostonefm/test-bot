# Grizzly Bot

## Overview
Grizzly Bot is a unified Discord bot designed for comprehensive DayZ server management, ticketing, moderation, and community engagement. It provides professional server monitoring, player tracking, administrative tools, and support through integrations with Nitrado hosting and Patreon subscription management. The system operates across multiple Discord servers, offering a cost-effective solution by consolidating all features into a single bot accessible via Discord slash commands, eliminating the need for external web dashboards.

Key capabilities include:
- DayZ Server Management: Real-time monitoring, log analysis, and player tracking.
- Ticket System: Support ticket creation, management, and prioritization.
- Moderation Tools: Kick, ban, mute functionalities, and detailed moderation logging.
- Economy System: Grizzly Coins currency (🪙) with balance tracking, daily rewards (100 coins), transfers, leaderboards, and transaction history.
- Patreon Integration: Management of subscription tiers and premium feature access, including Discord Linked Roles for automatic role assignment.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Application Structure
The system employs a dual-process architecture, with `app.js` bootstrapping the Discord bot (`index.js`) and an OAuth2 HTTP server (`server.js`) for Discord Linked Roles, running on port 5000. It utilizes a CommonJS module system.

### Database Layer
A PostgreSQL database, hosted on Neon (Azure), serves as the primary data store. It uses `pg` for connection pooling and migration-based schema management.

### Discord Bot Architecture
Built with Discord.js v14, the bot uses gateway intents, dynamic slash command loading, and an event-driven architecture. It supports multi-guild operation with distinct configurations for central and subscriber servers.

### Server Monitoring System
API-based polling system for DayZ log monitoring:
1. **LIST Endpoint**: Retrieves files from `/games/ni{serviceId}_1/noftp/dayzps/config` directory
2. **File Selection**: Automatically identifies the most recently modified `.ADM` or `.RPT` log file
3. **DOWNLOAD Endpoint**: Downloads the latest log file content
4. **Incremental Processing**: Tracks file position to process only new log lines
5. **Polling Interval**: 5-minute intervals to respect Nitrado API rate limits
6. **Auto-Detection**: Automatically fetches server details (map name, player count, max slots) from Nitrado API on startup and updates database accordingly

### Log Analysis Pipeline
The bot parses DayZ .ADM and .RPT files to detect events, generating kill feeds with detailed tracking and world event notifications. Event processing includes:
- **Kill Feed**: Player kills, deaths, and unconscious states
- **Connections**: Player join/leave events
- **World Events**: Dynamic event spawns (Heli Crash 🚁, Military Convoy 🪖, Police Car 🚓, Police Situation 🚨, Airplane Crate 📦, Train 🚂) with emoji-based visual indicators and exclusion filters
- **Items & Damage**: Building placement and PvE combat events
- **iZurvive Integration**: All coordinates (X, Y, Z) are displayed as clickable Discord links that open the exact location on iZurvive maps with automatic map detection (Chernarus, Livonia, Sakhal, Namalsk, Deer Isle, Esseker)

### Authentication & Authorization
1.  **Discord OAuth2 (Linked Roles)**: Handles user authentication for Patreon verification, featuring CSRF protection, secure cookies, and automatic tier-based role assignment.
2.  **Nitrado OAuth2**: Manages server owner authentication for API access, with encrypted token storage and automatic token refresh.
3.  **Multi-Key API Authentication**: Utilizes API keys and secrets for inter-service communication and dashboard synchronization.

### Channel Management System
Automated Discord channel and category creation, along with permission-based access control. Two distinct configurations:
1. **GCC (Grizzly Command Central)**: Bot headquarters for Patreon verification, support, and bot resources. Configured via `config/central.config.json` with tier-gated channels.
2. **Subscriber Servers**: DayZ community servers configured via `config/subscriber.config.json` with game-specific channels.

### Subscription Tier Features
- **Bronze Tier ($6/month):** Access to all GCC channels, 1 Discord guild/Nitrado server, standard support.
- **Silver Tier ($10/month):** All Bronze features, website posting privileges, 1 Discord guild/Nitrado server, standard support.
- **Gold Tier ($15/month):** All Bronze + Silver features, 2 Nitrado servers, gold server listing, early beta access, direct developer tagging, priority support.

### Privacy & Compliance
Features guild-level privacy settings and opt-in/opt-out mechanisms for data collection to ensure GDPR compliance.

### Tier Management
Integrates with Patreon for subscription tier management, enabling feature gating and command restrictions based on user tier levels.

### Player Linking & Economy System
**Satellite Verification Workflow:**
Players must be "spotted by satellite" (appear in the satellite/players-online channel) before linking their Discord to in-game character. This proof-of-play system ensures only actual players can link accounts.

**Linking Process:**
1. Player joins DayZ server and plays the game
2. Log monitoring system detects player activity and updates `player_status` table
3. Satellite channel displays online players (updated in real-time)
4. Player checks satellite channel to confirm they're listed
5. Player uses `/link-player player-name:YourName` in designated link channel
6. Bot verifies player is currently online (within last 30 minutes)
7. If verified: Creates player link, economy account, and assigns "Verified Player" role

**Economy Features:**
- Automatic economy account creation upon verified player linking
- Currency tracking (balance, earnings, spending)
- Shop system with categories and items
- Transaction history and bounty system
- Kill tracking with Discord user correlation

**Database Cleanup:**
- Automated daily cleanup at 3:00 AM removes log state entries older than 30 days
- Manual cleanup available via `/admin-cleanup` command with configurable retention period
- Prevents database bloat from log monitoring operations

## External Dependencies

### Third-Party APIs
-   **Nitrado API**: For game server management, file access, server info retrieval (map name, player count, slots, status), and server control (restart functionality).
-   **Discord API**: Powers bot interactions and OAuth2 authentication.
-   **Patreon API**: For validating subscription tiers and managing campaign access.
-   **iZurvive Maps**: Coordinate visualization via clickable links (https://dayz.ginfo.gg/) for in-game location display.

### Database
-   **Neon PostgreSQL**: The primary database, configured for SSL-required connections and pooled for performance.

### Key NPM Dependencies
-   `discord.js`: Discord bot framework.
-   `axios` with `axios-retry`: HTTP client with retry capabilities.
-   `pg`: PostgreSQL client.
-   `ws`: WebSocket client.
-   `winston`: Structured logging.
-   `chokidar`: File system monitoring.
-   `node-cron`: Scheduled task execution.

### Configuration Files
-   `.env`: Stores environment variables and secrets.
-   `config/central.config.json`: Central command server settings with Patreon tier-based permissions.
-   `config/subscriber.config.json`: Subscriber server configurations.
-   `config/game-paths.json`: DayZ game server path mappings for Nitrado.