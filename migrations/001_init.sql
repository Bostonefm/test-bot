
-- migrations/001_init.sql
-- Initialize core tables for Grizzly Bot

-- Nitrado credentials table (already exists, but ensuring consistency)
CREATE TABLE IF NOT EXISTS nitrado_creds (
    discord_id VARCHAR(20) PRIMARY KEY,
    encrypted_token TEXT NOT NULL,
    service_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Server statistics tracking
CREATE TABLE IF NOT EXISTS server_stats (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    player_count INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 0,
    map_name VARCHAR(100),
    server_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(service_id, timestamp)
);

-- Player session tracking
CREATE TABLE IF NOT EXISTS player_sessions (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    duration_minutes INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bot activity logs
CREATE TABLE IF NOT EXISTS bot_logs (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(20),
    guild_id VARCHAR(20),
    command_name VARCHAR(50) NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_server_stats_service_timestamp ON server_stats(service_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_player_sessions_service ON player_sessions(service_id);
CREATE INDEX IF NOT EXISTS idx_bot_logs_command_created ON bot_logs(command_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_guild ON bot_logs(guild_id);
