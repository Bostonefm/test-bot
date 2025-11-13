
-- Migration 024: Add active column to nitrado_credentials table
-- This fixes the monitoring startup error

ALTER TABLE nitrado_credentials 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Update existing records to be active by default
UPDATE nitrado_credentials 
SET active = TRUE 
WHERE active IS NULL;

-- Add an index for better performance on active queries
CREATE INDEX IF NOT EXISTS idx_nitrado_credentials_active 
ON nitrado_credentials(guild_id, active);
