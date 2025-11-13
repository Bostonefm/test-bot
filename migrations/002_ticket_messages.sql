
-- Ticket Messages for Web Dashboard
CREATE TABLE IF NOT EXISTS ticket_messages (
  message_id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  username VARCHAR NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(created_at);

-- Add assignment and closure columns to tickets table
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR,
ADD COLUMN IF NOT EXISTS assigned_by VARCHAR,
ADD COLUMN IF NOT EXISTS closed_by VARCHAR,
ADD COLUMN IF NOT EXISTS close_reason TEXT;

-- Add web dashboard session storage
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  data JSONB DEFAULT '{}',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
