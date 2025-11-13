# Project Structure

## Core Files
- `index.js` - Main Discord bot entry point
- `app.js` - Bootstrap file (validates env and starts bot)
- `migrate.js` - Database migration runner

## Configuration
- `.env` - Environment variables (use `.env.example` as template)
- `config/` - JSON configuration files
  - `central.config.json` - Grizzly Command Central server config
  - `assistant.config.json` - Ticket system configuration
  - `game-paths.json` - Game server path mappings (optional)

## Database
- `migrations/` - SQL migration files (numbered sequentially)
  - Main bot migrations (001-030)
  - Ticket system migrations (001_assistant_tables, etc.)

## Commands (97 total)
- `commands/` - Discord slash commands organized by category

### Server Management
- `nitrado-auth.js`, `nitrado-logs.js`, `list-services.js`
- `server-status.js`, `player-list.js`, `server-report.js`
- `setup-channels.js`, `cleanup-channels.js`, `sync-channels.js`

### Monitoring
- `start-periodic-monitoring.js`, `stop-periodic-monitoring.js`
- `periodic-monitoring-status.js`, `log-dashboard.js`
- `monitor-config.js`, `start-config-monitor.js`

### Tickets
- `ticket-create.js`, `ticket-close.js`, `ticket-list.js`
- `ticket-bulk.js`, `ticket-priority.js`, `ticket-button.js`

### Moderation
- `mod-ban.js`, `mod-unban.js`, `kick.js`, `mute.js`
- `mod-logs.js`, `auto-filter.js`

### Administration
- `announce.js`, `poll.js`, `remind.js`, `todo.js`
- `apply.js`, `approve.js`, `deny.js`

### Player Management
- `link-player.js`, `verify-player.js`, `auto-verify-online.js`
- `player-stats.js`, `verification-list.js`

### Economy
- `economy balance`, `economy daily`, `economy transfer`
- `economy leaderboard`, `economy transactions`

### GCC Management
- `gcc-setup-channels.js`, `gcc-cleanup-channels.js`
- `gcc-populate-*.js` commands for channel setup

### Help & Utilities
- `help.js`, `assistant-help.js`, `bot-info-message.js`
- `integration-status.js`, `server-features.js`

## Modules
- `modules/` - Core functionality modules

### Database & Core
- `db.js` - PostgreSQL connection and utilities
- `logger.js` - Winston logging wrapper
- `env-validator.js` - Environment validation

### Nitrado Integration
- `nitrado.js` - Nitrado API wrapper
- `nitradoAuth.js` - OAuth2 authentication
- `nitradoFiles.js` - File management
- `nitradoConsole.js` - Server console access
- `nitradoPollingMonitor.js` - Real-time polling monitor
- `periodicLogMonitor.js` - Periodic log monitoring
- `gamePathResolver.js` - Game file path discovery

### Analysis & Notifications
- `logAnalyzer.js` - Log parsing and event detection
- `killParser.js` - Kill feed parsing
- `discordNotifications.js` - Discord messaging utilities
- `notification-system.js` - Notification management

### Server Management
- `bootstrap.js` - Guild setup and initialization
- `subscriberServerManager.js` - Multi-guild management
- `satelliteUpdater.js` - Satellite channel updates
- `guildPrivacy.js` - Privacy settings manager
- `tierManager.js` - Patreon tier management

### Assistant Bot Features
- `auto-setup.js` - Automated server setup
- `rate-limiter.js` - API rate limiting
- `reminder-processor.js` - Reminder system
- `permissions.js` - Permission management
- `error-recovery.js` - Error handling
- `health-checker.js` - System health monitoring

### File Monitoring
- `logWatcher.js` - File change detection
- `specificLogWatcher.js` - Targeted log watching
- `configMonitor.js` - Config file monitoring
- `configFileMonitor.js` - Config change detection

## Utilities
- `utils/` - Helper utilities
  - `logger.js` - Winston logging configuration
  - `encryption.js` - Token encryption/decryption (AES-256-GCM)
  - `envValidator.js` - Environment variable validation

## License & Metadata
- `LICENSE` - MIT License
- `package.json` - Dependencies and scripts
- `README.md` - Project overview
- `replit.md` - Replit-specific documentation

## Removed Components (v2.0 Consolidation)

The following were removed to simplify the architecture:
- ❌ `api-server.js` - Web API server
- ❌ `routes/` - API route handlers
- ❌ `public/` - Static web files
- ❌ `web-dashboard/` - Web-based ticket dashboard
- ❌ `auth.js` - OAuth authentication for web
- ❌ `proxy-server.js` - Reverse proxy
- ❌ Dashboard-related database migrations

All functionality is now handled through Discord commands only.
