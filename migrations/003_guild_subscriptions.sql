
-- migrations/003_guild_subscriptions.sql
-- Track guild subscriptions and metadata

CREATE TABLE IF NOT EXISTS guild_subscriptions (
    guild_id VARCHAR(20) PRIMARY KEY,
    guild_name VARCHAR(100),
    owner_id VARCHAR(20),
    member_count INTEGER,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    joined_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    auto_setup_completed BOOLEAN DEFAULT FALSE,
    nitrado_connected BOOLEAN DEFAULT FALSE,
    total_channels_created INTEGER DEFAULT 0,
    total_monitoring_hours INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_guild_subscriptions_joined_at ON guild_subscriptions(joined_at);
CREATE INDEX IF NOT EXISTS idx_guild_subscriptions_tier ON guild_subscriptions(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_guild_subscriptions_active ON guild_subscriptions(last_active);

-- Function to update guild activity
CREATE OR REPLACE FUNCTION update_guild_activity(guild_id_param VARCHAR(20))
RETURNS VOID AS $$
BEGIN
    UPDATE guild_subscriptions 
    SET last_active = NOW(), updated_at = NOW()
    WHERE guild_id = guild_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to mark Nitrado as connected
CREATE OR REPLACE FUNCTION set_nitrado_connected(guild_id_param VARCHAR(20), connected BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE guild_subscriptions 
    SET nitrado_connected = connected, updated_at = NOW()
    WHERE guild_id = guild_id_param;
    
    IF NOT FOUND THEN
        INSERT INTO guild_subscriptions (guild_id, nitrado_connected)
        VALUES (guild_id_param, connected);
    END IF;
END;
$$ LANGUAGE plpgsql;
