
-- Add token_iv column to nitrado_creds for GCM encryption
ALTER TABLE nitrado_creds ADD COLUMN IF NOT EXISTS token_iv TEXT;

-- Update the comment to reflect the complete encryption format
COMMENT ON TABLE nitrado_creds IS 'Stores encrypted Nitrado API tokens using AES-256-GCM with iv and auth_tag';
