
-- Add automation tracking columns
ALTER TABLE registered_servers 
ADD COLUMN IF NOT EXISTS ticket_category_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_notifications BOOLEAN DEFAULT true;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_registered_servers_setup 
ON registered_servers(setup_completed, auto_notifications);
