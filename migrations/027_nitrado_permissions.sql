
-- Create nitrado_permissions table for managing user access levels
CREATE TABLE IF NOT EXISTS nitrado_permissions (
    guild_id VARCHAR(20) NOT NULL,
    discord_id VARCHAR(20) NOT NULL,
    service_id VARCHAR(50) NOT NULL,
    permission_level INTEGER NOT NULL DEFAULT 1,
    granted_by VARCHAR(20),
    granted_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, discord_id, service_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_nitrado_permissions_guild_service ON nitrado_permissions(guild_id, service_id);
CREATE INDEX IF NOT EXISTS idx_nitrado_permissions_user ON nitrado_permissions(discord_id);

-- Add comments for documentation
COMMENT ON TABLE nitrado_permissions IS 'Manages user permission levels for Nitrado services';
COMMENT ON COLUMN nitrado_permissions.permission_level IS '0=None, 1=Viewer, 2=Operator, 3=Admin, 4=Owner';
