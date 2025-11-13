
-- Guild access logging for security monitoring
CREATE TABLE IF NOT EXISTS guild_access_logs (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (guild_id) REFERENCES guild_subscriptions(guild_id) ON DELETE CASCADE
);

-- Encrypted guild data storage
CREATE TABLE IF NOT EXISTS guild_encrypted_data (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    encrypted_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (guild_id) REFERENCES guild_subscriptions(guild_id) ON DELETE CASCADE,
    UNIQUE(guild_id, data_type)
);

-- Guild privacy settings
CREATE TABLE IF NOT EXISTS guild_privacy_settings (
    guild_id VARCHAR(20) PRIMARY KEY,
    data_retention_days INTEGER DEFAULT 30,
    allow_cross_guild_sharing BOOLEAN DEFAULT FALSE,
    encrypt_player_data BOOLEAN DEFAULT TRUE,
    log_access_attempts BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (guild_id) REFERENCES guild_subscriptions(guild_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_access_logs_guild_timestamp ON guild_access_logs(guild_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_action ON guild_access_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_encrypted_data_guild_type ON guild_encrypted_data(guild_id, data_type);

-- Function to clean old access logs
CREATE OR REPLACE FUNCTION cleanup_old_access_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM guild_access_logs 
    WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Insert default privacy settings for existing guilds
INSERT INTO guild_privacy_settings (guild_id)
SELECT guild_id FROM guild_subscriptions
ON CONFLICT (guild_id) DO NOTHING;
