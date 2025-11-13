
-- Create nitrado_credentials table with proper structure
CREATE TABLE IF NOT EXISTS nitrado_credentials (
    discord_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    encrypted_token TEXT NOT NULL,
    service_id VARCHAR(50) NOT NULL,
    token_iv TEXT,
    auth_tag TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (discord_id, guild_id)
);

-- Create index for faster guild-based lookups
CREATE INDEX IF NOT EXISTS idx_nitrado_credentials_guild_id ON nitrado_credentials(guild_id);

-- Add comment for documentation
COMMENT ON TABLE nitrado_credentials IS 'Stores encrypted Nitrado API tokens using AES-256-GCM with iv and auth_tag';

-- If nitrado_creds table exists, migrate data and drop it
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nitrado_creds') THEN
        -- Migrate data from old table
        INSERT INTO nitrado_credentials (discord_id, guild_id, encrypted_token, service_id, token_iv, auth_tag, updated_at)
        SELECT 
            discord_id,
            COALESCE(guild_id, 'default') as guild_id,
            encrypted_token,
            service_id,
            token_iv,
            auth_tag,
            COALESCE(updated_at, NOW()) as updated_at
        FROM nitrado_creds
        ON CONFLICT (discord_id, guild_id) DO NOTHING;
        
        -- Drop old table
        DROP TABLE nitrado_creds;
        
        RAISE NOTICE 'Migrated data from nitrado_creds to nitrado_credentials and dropped old table';
    ELSE
        RAISE NOTICE 'nitrado_creds table does not exist, created fresh nitrado_credentials table';
    END IF;
END $$;
