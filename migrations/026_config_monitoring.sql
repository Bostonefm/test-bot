
-- Config monitoring table for tracking file changes
CREATE TABLE IF NOT EXISTS config_monitoring (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    service_id VARCHAR(20) NOT NULL,
    paths JSONB NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    stopped_at TIMESTAMP,
    active BOOLEAN DEFAULT true,
    last_check TIMESTAMP,
    file_states JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, service_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_config_monitoring_active 
ON config_monitoring(guild_id, service_id, active);

-- Table for storing config file change history
CREATE TABLE IF NOT EXISTS config_file_changes (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    service_id VARCHAR(20) NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    change_type VARCHAR(50) NOT NULL, -- 'created', 'modified', 'deleted'
    old_size BIGINT,
    new_size BIGINT,
    detected_at TIMESTAMP DEFAULT NOW(),
    notified BOOLEAN DEFAULT false
);

-- Index for change history
CREATE INDEX IF NOT EXISTS idx_config_file_changes_recent 
ON config_file_changes(guild_id, service_id, detected_at DESC);
