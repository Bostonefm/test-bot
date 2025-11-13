
-- Rename nitrado_creds table to nitrado_credentials for consistency
ALTER TABLE IF EXISTS nitrado_creds RENAME TO nitrado_credentials;

-- Update any indexes that might exist
DROP INDEX IF EXISTS idx_nitrado_creds_guild_id;
CREATE INDEX IF NOT EXISTS idx_nitrado_credentials_guild_id ON nitrado_credentials(guild_id);

-- Ensure all required columns exist
ALTER TABLE nitrado_credentials ADD COLUMN IF NOT EXISTS guild_id VARCHAR(20);
ALTER TABLE nitrado_credentials ADD COLUMN IF NOT EXISTS auth_tag TEXT;
ALTER TABLE nitrado_credentials ADD COLUMN IF NOT EXISTS token_iv TEXT;
ALTER TABLE nitrado_credentials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Make sure guild_id is not null for existing records
UPDATE nitrado_credentials SET guild_id = 'default' WHERE guild_id IS NULL;
ALTER TABLE nitrado_credentials ALTER COLUMN guild_id SET NOT NULL;

-- Update primary key constraint
ALTER TABLE nitrado_credentials DROP CONSTRAINT IF EXISTS nitrado_creds_pkey;
ALTER TABLE nitrado_credentials DROP CONSTRAINT IF EXISTS nitrado_credentials_pkey;
ALTER TABLE nitrado_credentials ADD CONSTRAINT nitrado_credentials_pkey PRIMARY KEY (guild_id);
