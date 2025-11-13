
-- 007_fix_nitrado_creds_pk.sql
-- Fix primary key to support per-guild credentials

-- First, update NULL guild_id values to a default value
UPDATE nitrado_creds SET guild_id = 'default' WHERE guild_id IS NULL;

-- Drop existing primary key constraint if it exists
ALTER TABLE nitrado_creds DROP CONSTRAINT IF EXISTS nitrado_creds_pkey;

-- Now make guild_id NOT NULL (after we've handled the NULL values)
ALTER TABLE nitrado_creds ALTER COLUMN guild_id SET NOT NULL;

-- Add composite primary key
ALTER TABLE nitrado_creds ADD CONSTRAINT nitrado_creds_pkey PRIMARY KEY (discord_id, guild_id);
