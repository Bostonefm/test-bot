
-- Guild members table for tracking which users belong to which guilds
CREATE TABLE IF NOT EXISTS guild_members (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(255) NOT NULL,
    discord_id VARCHAR(255) NOT NULL,
    join_date TIMESTAMP DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, discord_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_guild_members_guild_id ON guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_discord_id ON guild_members(discord_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_admin ON guild_members(guild_id, is_admin) WHERE is_admin = TRUE;
