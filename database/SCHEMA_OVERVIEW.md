🧩 Grizzly Gaming Unified Database Overview

Database: Neon — GrizzlyDB
Owner: neondb_owner
Last Updated: November 2025

This schema powers the entire Grizzly ecosystem:

🐻 Grizzly Bot (DayZ & Nitrado automation)

🧠 Grizzly OS (GCC management & Discord integration)

🌐 GrizzlyGaming-GG.com (website, dashboards, supporter portal)

All systems share the same Neon database using per-guild isolation (guild_id) and cross-project interoperability.

🧠 Core / Shared Structure
Table	Purpose
grizzly_users	Master user registry linking Discord, Patreon, and platform IDs.
guild_sync	Tracks bot status per guild (active/sleep/error) with timestamps.
guild_channels	Maps important Discord channel IDs for each guild.
guild_feed_map	Defines feed category → channel mappings for automated messages.
interbot_events	Internal message bus for Grizzly bots to communicate.
audit_log	Global administrative log for configuration or moderation events.
update_logs, bot_updates, bot_logs	Versioning, changelogs, and internal system updates.
🧩 Grizzly Bot — DayZ / Nitrado / Economy
Table	Purpose
nitrado_tokens, nitrado_oauth_tokens, nitrado_creds, nitrado_credentials	Store and manage Nitrado API OAuth tokens for each guild.
nitrado_services	Core service registry per guild/server; stores name, map, and active status.
nitrado_log_state	Tracks read position in Nitrado log files for incremental updates.
nitrado_permissions	Custom permissions for Nitrado server control via Discord.
player_profiles	Player identity table — Discord ↔ in-game link, kills, deaths, XP, economy totals.
player_status, player_sessions, player_activity, player_links	Live activity tracking, session management, and linking information.
kill_logs, bounties	Game event logs for kills, bounties, or PvP data.
economy_accounts, economy_transactions, economy_settings, economy_kill_settings	Player economy system; transactions ledger and reward configuration.
mod_configs, feature_flags, channel_content_log	Game configuration overrides and feature toggles.
registered_servers, server_features, server_stats, server_status, server_listings, server_registration_tickets, resource_stats	Detailed server metadata, feature sets, and live statistics from Nitrado.
delivery_coordinates, dynamic_event_settings	Mission / event configuration used by DayZ integrations.
🧠 Grizzly OS — Discord / GCC Management
Table	Purpose
tickets, ticket_logs, ticket_messages, ticket_analytics	Ticketing system for support and user issues.
guild_members, guild_monitoring_status, guild_dashboard_sync	Server membership, monitoring heartbeat, and dashboard sync states.
mod_configs	Guild-specific moderation and role setup.
audit_log, interbot_events, service_notifications	Logging, inter-service messaging, and alert notifications.
response_times, log_events	Tracks API and event response latency for diagnostics.
🌐 GrizzlyGaming-GG.com — Website / Patreon / Dashboards
Table	Purpose
patreon_subscriptions, patreon_sync_logs, patreon_verification_requests	Store Patreon data, last sync times, and verification results.
subscriptions, guild_subscriptions, users, verification_requests, session, user_sessions	Website account management and session control.
dashboard_data, guild_dashboard_sync	Cached analytics for dashboards and web UI.
shop_categories, shop_items, shop_purchases	E-commerce module for supporter or in-game item purchases.
websocket_connections, token_refresh_errors	Real-time website ↔ bot socket connections and token error logs.
🧾 Miscellaneous / Shared Utilities
Table	Purpose
migrations	Records executed schema migrations for version control.
service_notifications, resource_stats	System-level monitoring.
registered_servers, server_features	Base server registry.
guild_monitoring_status	Keeps heartbeat and uptime per guild.
⚙️ Schema Maintenance & Versioning

File structure recommendation

database/
├── schema/
│   ├── 00_core.sql
│   ├── 10_patronage.sql
│   ├── 20_gameplay.sql
│   ├── 30_nitrado.sql
│   ├── 40_os_management.sql
│   └── 99_indexes.sql
└── migrations/
    ├── 2025-11-04_add_player_profiles.sql
    ├── 2025-11-04_add_nitrado_services.sql
    └── future_updates.sql


Routine tasks

Run pg_dump --schema-only "$DATABASE_URL" > database/schema/grizzly_full_dump.sql before major updates.

Apply updates with psql "$DATABASE_URL" -f database/schema/grizzly_core_schema.sql.

Keep grizzly_core_schema.sql as your canonical reference (now v1.1).

🔒 Key Integration Notes

All guild-scoped tables include guild_id to guarantee multi-tenant safety.

Patreon, player, and Nitrado data are cross-linked via shared Discord and guild IDs.

interbot_events + guild_sync form the foundation for future cross-bot coordination.

Schema designed to be non-destructive: every migration uses CREATE IF NOT EXISTS or ON CONFLICT DO NOTHING.

🧭 Next Steps

Keep this file (SCHEMA_OVERVIEW.md) updated whenever you add or modify tables.

Commit your modular .sql files into version control.

(Optional) generate nightly pg_dump --schema-only backups to track drift.

Add version headers to each .sql file, e.g. -- v1.2 (2025-11-06).
