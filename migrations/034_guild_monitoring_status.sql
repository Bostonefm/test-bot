-- Guild monitoring status table for tracking auto-started monitoring
CREATE TABLE IF NOT EXISTS guild_monitoring_status (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    service_id VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    auto_started BOOLEAN DEFAULT false,
    started_at TIMESTAMP DEFAULT NOW(),
    stopped_at TIMESTAMP,
    last_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, service_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guild_monitoring_status_active 
ON guild_monitoring_status(guild_id, service_id, is_active);
