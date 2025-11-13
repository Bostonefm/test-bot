
-- Migration to add welcome message fields to guild_settings table
CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id VARCHAR(20) PRIMARY KEY,
    welcome_title VARCHAR(100),
    welcome_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_guild_settings_guild_id ON guild_settings(guild_id);

-- Add trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_guild_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_guild_settings_updated_at
    BEFORE UPDATE ON guild_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_guild_settings_updated_at();
