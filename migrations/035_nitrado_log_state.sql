-- Nitrado log state tracking for polling monitor
CREATE TABLE IF NOT EXISTS nitrado_log_state (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    service_id VARCHAR(20) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    last_position BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, service_id, file_name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_nitrado_log_state_lookup 
ON nitrado_log_state(guild_id, service_id, file_name);
