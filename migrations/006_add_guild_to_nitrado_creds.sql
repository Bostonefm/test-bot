
-- Add guild_id column to nitrado_creds table for guild-based credential storage
ALTER TABLE nitrado_creds ADD COLUMN IF NOT EXISTS guild_id VARCHAR(20);

-- Create index for faster guild-based lookups
CREATE INDEX IF NOT EXISTS idx_nitrado_creds_guild_id ON nitrado_creds(guild_id);

-- Update existing records to use a default guild (you may need to update this manually)
-- UPDATE nitrado_creds SET guild_id = 'your_default_guild_id' WHERE guild_id IS NULL;
