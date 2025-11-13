-- ==========================================================
-- 🐻 Grizzly Bot — Core Database Schema (Unified v2.0)
-- ==========================================================

-- 🗂 Authorized guilds (Patreon / verification system)
CREATE TABLE IF NOT EXISTS grizzly_authorized_guilds (
  guild_id TEXT PRIMARY KEY,
  guild_name TEXT NOT NULL,
  authorized BOOLEAN DEFAULT FALSE,
  tier TEXT DEFAULT 'none',
  expires_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 🧾 Patreon / subscription info
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES grizzly_authorized_guilds(guild_id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'none',
  active BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure tier column exists for older installs
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'none';
ALTER TABLE grizzly_authorized_guilds ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'none';

-- 🧩 Nitrado credentials
CREATE TABLE IF NOT EXISTS nitrado_credentials (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES grizzly_authorized_guilds(guild_id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  encrypted_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 🛰 Guild channels (Satellite, connections, etc.)
CREATE TABLE IF NOT EXISTS guild_channels (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES grizzly_authorized_guilds(guild_id) ON DELETE CASCADE,
  satellite_channel_id TEXT NULL,
  connections_channel_id TEXT NULL,
  logs_channel_id TEXT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 🧠 Player profiles (linked Discord users)
CREATE TABLE IF NOT EXISTS player_profiles (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES grizzly_authorized_guilds(guild_id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  ingame_name TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  linked_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 🧭 Player live status
CREATE TABLE IF NOT EXISTS player_status (
  id SERIAL PRIMARY KEY,
  service_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  status TEXT DEFAULT 'offline', -- online | offline
  last_seen TIMESTAMP DEFAULT NOW(),
  UNIQUE(service_id, player_name)
);

-- 🧾 Websocket/connection heartbeat log
CREATE TABLE IF NOT EXISTS websocket_connections (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  last_seen_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'ok',  -- ok | error
  detail TEXT,
  UNIQUE (guild_id, service_id)
);

-- 🪄 Log cache or event store
CREATE TABLE IF NOT EXISTS log_events (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  filename TEXT,
  event_type TEXT,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ==========================================================
-- ✅ Indexes for faster lookups
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_guild ON subscriptions(guild_id);
CREATE INDEX IF NOT EXISTS idx_creds_guild ON nitrado_credentials(guild_id);
CREATE INDEX IF NOT EXISTS idx_status_service ON player_status(service_id);
CREATE INDEX IF NOT EXISTS idx_profiles_guild ON player_profiles(guild_id);
CREATE INDEX IF NOT EXISTS idx_ws_guild ON websocket_connections(guild_id);

-- ==========================================================
-- ✅ Views / Helpers (Optional)
-- ==========================================================
-- View of verified, active guilds with tier info
CREATE OR REPLACE VIEW verified_guilds AS
SELECT g.guild_id, g.guild_name, g.tier, g.authorized, s.active, s.expires_at
FROM grizzly_authorized_guilds g
LEFT JOIN subscriptions s ON s.guild_id = g.guild_id;

-- ==========================================================
-- ✅ Post-deploy check
-- ==========================================================
SELECT '✅ Grizzly Bot schema synchronized successfully.' AS status;
