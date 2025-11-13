
-- Migration 029: Player tracking and statistics
CREATE TABLE IF NOT EXISTS player_status (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    player_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(service_id, player_name)
);

CREATE TABLE IF NOT EXISTS kill_events (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL,
    killer_name VARCHAR(100) NOT NULL,
    victim_name VARCHAR(100) NOT NULL,
    weapon VARCHAR(100),
    location_x DECIMAL(10,2) DEFAULT 0,
    location_y DECIMAL(10,2) DEFAULT 0,
    location_z DECIMAL(10,2) DEFAULT 0,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_locations (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    player_id VARCHAR(100),
    location_x DECIMAL(10,2) DEFAULT 0,
    location_y DECIMAL(10,2) DEFAULT 0,
    location_z DECIMAL(10,2) DEFAULT 0,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(service_id, player_name)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_status_service ON player_status(service_id);
CREATE INDEX IF NOT EXISTS idx_kill_events_service ON kill_events(service_id);
CREATE INDEX IF NOT EXISTS idx_kill_events_timestamp ON kill_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_player_locations_service ON player_locations(service_id);

-- Add new channel columns to guild_channels table
ALTER TABLE guild_channels 
ADD COLUMN IF NOT EXISTS admin_activity_channel_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS building_activity_channel_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS player_location_channel_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS dynamic_events_channel_id VARCHAR(20);
