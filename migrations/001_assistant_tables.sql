-- Enhanced Tickets System
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id SERIAL PRIMARY KEY,
  type VARCHAR NOT NULL DEFAULT 'support',
  category VARCHAR,
  priority VARCHAR DEFAULT 'medium',
  title VARCHAR,
  channel_id VARCHAR,
  message_id VARCHAR,
  data JSONB DEFAULT '{}',
  status VARCHAR DEFAULT 'open',
  created_by VARCHAR NOT NULL,
  assigned_to VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Add indexes for better query performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- Moderation configs
CREATE TABLE IF NOT EXISTS mod_configs (
  guild_id VARCHAR PRIMARY KEY,
  blacklist TEXT[],
  spam_threshold JSONB,
  alt_account_days INT,
  log_channel_id VARCHAR,
  default_mute_duration INT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Server listings
CREATE TABLE IF NOT EXISTS server_listings (
  listing_id SERIAL PRIMARY KEY,
  guild_id VARCHAR,
  server_name VARCHAR,
  description TEXT,
  invite_link VARCHAR,
  member_count INT,
  
  featured BOOLEAN DEFAULT FALSE,
  status VARCHAR DEFAULT 'pending',
  submitted_by VARCHAR,
  approved_by VARCHAR,
  ticket_id INT REFERENCES tickets(ticket_id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User tracking (for general bot usage)
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR PRIMARY KEY,
  guild_ids TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);