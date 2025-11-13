
-- Create server_stats table for storing server monitoring data
CREATE TABLE IF NOT EXISTS server_stats (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    player_count INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 0,
    server_status TEXT DEFAULT 'unknown',
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_server_stats_guild_service 
    ON server_stats(guild_id, service_id);
CREATE INDEX IF NOT EXISTS idx_server_stats_timestamp 
    ON server_stats(timestamp);

-- Create index for recent stats queries
CREATE INDEX IF NOT EXISTS idx_server_stats_recent 
    ON server_stats(guild_id, service_id, timestamp DESC);
