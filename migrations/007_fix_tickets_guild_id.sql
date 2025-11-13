
-- Fix missing guild_id column in tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS guild_id VARCHAR(20);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);

-- Update existing tickets to have guild_id if possible
-- This would need to be done manually based on your data
