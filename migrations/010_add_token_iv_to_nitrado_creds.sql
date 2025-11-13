
-- Add token_iv column for GCM encryption
ALTER TABLE nitrado_creds 
ADD COLUMN IF NOT EXISTS token_iv TEXT;

-- Update existing records to have proper structure
UPDATE nitrado_creds 
SET token_iv = NULL 
WHERE token_iv IS NULL;
