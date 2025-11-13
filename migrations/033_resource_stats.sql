-- Migration: Add resource_stats table for CPU/RAM/player tracking
-- Created: 2025-10-15

CREATE TABLE IF NOT EXISTS resource_stats (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Player stats
    current_players INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 0,
    
    -- Resource stats
    cpu_usage FLOAT,
    memory_usage FLOAT,
    
    -- Metadata
    data_timestamp BIGINT NOT NULL,
    
    UNIQUE(service_id, data_timestamp)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_resource_stats_service ON resource_stats(service_id);
CREATE INDEX IF NOT EXISTS idx_resource_stats_guild ON resource_stats(guild_id);
CREATE INDEX IF NOT EXISTS idx_resource_stats_timestamp ON resource_stats(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_resource_stats_service_time ON resource_stats(service_id, timestamp DESC);

-- Index for finding recent stats efficiently
CREATE INDEX IF NOT EXISTS idx_resource_stats_recent 
ON resource_stats(service_id, timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '24 hours';

COMMENT ON TABLE resource_stats IS 'Historical resource usage data for Nitrado gameservers';
COMMENT ON COLUMN resource_stats.current_players IS 'Number of players online at this timestamp';
COMMENT ON COLUMN resource_stats.cpu_usage IS 'CPU usage percentage';
COMMENT ON COLUMN resource_stats.memory_usage IS 'Memory usage in MB';
COMMENT ON COLUMN resource_stats.data_timestamp IS 'Unix timestamp from Nitrado API';
