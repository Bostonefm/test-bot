
-- Add auth_tag column to nitrado_creds for GCM encryption
ALTER TABLE nitrado_creds ADD COLUMN IF NOT EXISTS auth_tag TEXT;

-- Update the comment to reflect the new encryption format
COMMENT ON TABLE nitrado_creds IS 'Stores encrypted Nitrado API tokens using AES-256-GCM';
