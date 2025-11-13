
-- migrations/002_feature_flags.sql
-- Feature flags for per-guild configuration

CREATE TABLE IF NOT EXISTS feature_flags (
    guild_id VARCHAR(20) PRIMARY KEY,
    flags JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Default feature flags structure (stored as JSONB)
-- {
--   "auto_status_updates": true,
--   "player_join_notifications": false,
--   "kill_feed_enabled": true,
--   "leaderboards_enabled": true,
--   "admin_notifications": true,
--   "scheduled_restarts": false
-- }

-- Add some utility functions for feature flag management
CREATE OR REPLACE FUNCTION get_feature_flag(guild_id_param VARCHAR(20), flag_name VARCHAR(50))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT flags->>flag_name FROM feature_flags WHERE guild_id = guild_id_param)::boolean,
        false
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_feature_flag(guild_id_param VARCHAR(20), flag_name VARCHAR(50), flag_value BOOLEAN)
RETURNS VOID AS $$
BEGIN
    INSERT INTO feature_flags (guild_id, flags, updated_at)
    VALUES (guild_id_param, jsonb_build_object(flag_name, flag_value), NOW())
    ON CONFLICT (guild_id) DO UPDATE
    SET flags = feature_flags.flags || jsonb_build_object(flag_name, flag_value),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
