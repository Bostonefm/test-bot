
-- 011_player_links.sql
-- Create table for linking Discord users to in-game characters

CREATE TABLE IF NOT EXISTS player_links (
    discord_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    ingame_name VARCHAR(100) NOT NULL,
    linked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (discord_id, guild_id),
    UNIQUE(guild_id, ingame_name)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_player_links_guild_ingame 
  ON player_links(guild_id, ingame_name);

CREATE INDEX IF NOT EXISTS idx_player_links_discord_id 
  ON player_links(discord_id);
