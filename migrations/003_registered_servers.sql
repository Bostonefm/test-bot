
-- Registered Servers table for tracking servers using Grizzly Assistant Bot
CREATE TABLE IF NOT EXISTS registered_servers (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) UNIQUE NOT NULL,
    owner_id VARCHAR(20) NOT NULL,
    server_name VARCHAR(100) NOT NULL,
    description TEXT,
    invite_link VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    features_enabled TEXT[], -- Array of enabled features
    setup_type VARCHAR(20) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Server features tracking
CREATE TABLE IF NOT EXISTS server_features (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES registered_servers(guild_id),
    feature_name VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    configuration JSON,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_registered_servers_guild_id ON registered_servers(guild_id);
CREATE INDEX IF NOT EXISTS idx_server_features_guild_id ON server_features(guild_id);
-- Registered Servers table for ticket system
CREATE TABLE IF NOT EXISTS registered_servers (
  guild_id VARCHAR(20) PRIMARY KEY,
  server_name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id VARCHAR(20) NOT NULL,
  admin_ids TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  features JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_registered_servers_owner_id ON registered_servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_registered_servers_status ON registered_servers(status);
