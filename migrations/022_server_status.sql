
-- Server status tracking table
CREATE TABLE IF NOT EXISTS server_status (
    service_id VARCHAR(50) PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'unknown',
    player_count VARCHAR(20) DEFAULT '0/0',
    last_update TIMESTAMP DEFAULT NOW(),
    server_name VARCHAR(255),
    game_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Player activity tracking table
CREATE TABLE IF NOT EXISTS player_activity (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(50) REFERENCES server_status(service_id),
    player_name VARCHAR(255),
    action VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    ping INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_server_status_last_update ON server_status(last_update);
CREATE INDEX IF NOT EXISTS idx_player_activity_service_id ON player_activity(service_id);
CREATE INDEX IF NOT EXISTS idx_player_activity_last_seen ON player_activity(last_seen);
CREATE INDEX IF NOT EXISTS idx_player_activity_player_name ON player_activity(player_name);
