-- WebSocket connection tracking for Nitrado streaming
CREATE TABLE IF NOT EXISTS websocket_connections (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(20) UNIQUE NOT NULL,
    connection_type VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT false,
    last_update TIMESTAMP DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for active connection lookups
CREATE INDEX IF NOT EXISTS idx_websocket_connections_active 
ON websocket_connections(service_id, active);
