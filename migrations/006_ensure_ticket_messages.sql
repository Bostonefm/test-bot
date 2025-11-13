
-- Ensure ticket_messages table exists with proper structure
CREATE TABLE IF NOT EXISTS ticket_messages (
  message_id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  username VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id) ON DELETE CASCADE
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(created_at);
