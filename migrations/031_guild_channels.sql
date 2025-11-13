
-- Create guild_channels table for tracking channel configurations
CREATE TABLE IF NOT EXISTS guild_channels (
    guild_id VARCHAR(20) NOT NULL,
    welcome_channel_id VARCHAR(20),
    rules_channel_id VARCHAR(20),
    link_channel_id VARCHAR(20),
    satellite_channel_id VARCHAR(20),
    admin_activity_channel_id VARCHAR(20),
    building_activity_channel_id VARCHAR(20),
    player_location_channel_id VARCHAR(20),
    dynamic_events_channel_id VARCHAR(20),
    kill_feed_channel_id VARCHAR(20),
    pve_feed_channel_id VARCHAR(20),
    connections_feed_channel_id VARCHAR(20),
    event_feed_channel_id VARCHAR(20),
    placed_items_channel_id VARCHAR(20),
    flag_feed_channel_id VARCHAR(20),
    faction_logs_channel_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_guild_channels_satellite ON guild_channels(satellite_channel_id) WHERE satellite_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guild_channels_link ON guild_channels(link_channel_id) WHERE link_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guild_channels_welcome ON guild_channels(welcome_channel_id) WHERE welcome_channel_id IS NOT NULL;

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_guild_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
CREATE TRIGGER update_guild_channels_updated_at
    BEFORE UPDATE ON guild_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_guild_channels_updated_at();
