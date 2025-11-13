
-- 013_player_verification.sql
-- Add verification system to player links

-- Add verification columns to existing player_links table
ALTER TABLE player_links 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Create verification requests table for tracking pending verifications
CREATE TABLE IF NOT EXISTS verification_requests (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    ingame_name VARCHAR(100) NOT NULL,
    requested_at TIMESTAMP DEFAULT NOW(),
    admin_notes TEXT,
    FOREIGN KEY (discord_id, guild_id) REFERENCES player_links(discord_id, guild_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_links_verified 
  ON player_links(guild_id, verified);

CREATE INDEX IF NOT EXISTS idx_verification_requests_guild 
  ON verification_requests(guild_id, requested_at);
