
-- Create nitrado_oauth_tokens table for OAuth2 flow
CREATE TABLE IF NOT EXISTS nitrado_oauth_tokens (
    guild_id VARCHAR(20) NOT NULL,
    discord_id VARCHAR(20) NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    access_token_iv VARCHAR(32) NOT NULL,
    access_token_auth_tag VARCHAR(32) NOT NULL,
    encrypted_refresh_token TEXT,
    refresh_token_iv VARCHAR(32),
    refresh_token_auth_tag VARCHAR(32),
    expires_at TIMESTAMP NOT NULL,
    scope TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, discord_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_nitrado_oauth_tokens_guild ON nitrado_oauth_tokens(guild_id);
CREATE INDEX IF NOT EXISTS idx_nitrado_oauth_tokens_user ON nitrado_oauth_tokens(discord_id);
CREATE INDEX IF NOT EXISTS idx_nitrado_oauth_tokens_expires ON nitrado_oauth_tokens(expires_at);

-- Add comments for documentation
COMMENT ON TABLE nitrado_oauth_tokens IS 'Stores OAuth2 access and refresh tokens for Nitrado API';
COMMENT ON COLUMN nitrado_oauth_tokens.scope IS 'OAuth2 scopes granted to the token';
COMMENT ON COLUMN nitrado_oauth_tokens.expires_at IS 'When the access token expires';
