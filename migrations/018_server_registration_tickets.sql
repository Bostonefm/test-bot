
-- migrations/018_server_registration_tickets.sql
-- Server registration ticket system for tier subscribers

CREATE TABLE IF NOT EXISTS server_registration_tickets (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    tier VARCHAR(20) NOT NULL,
    server_name VARCHAR(255) NOT NULL,
    server_description TEXT,
    server_ip VARCHAR(45),
    server_port INTEGER,
    max_players INTEGER,
    discord_invite VARCHAR(255),
    website_url VARCHAR(255),
    mod_list TEXT,
    server_rules TEXT,
    contact_info VARCHAR(255),
    additional_info TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    processed_by VARCHAR(20),
    processed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS server_listings (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES server_registration_tickets(id),
    gcc_guild_id VARCHAR(20) NOT NULL, -- Always GCC guild ID
    user_id VARCHAR(20) NOT NULL,
    tier VARCHAR(20) NOT NULL,
    server_name VARCHAR(255) NOT NULL,
    server_description TEXT,
    server_ip VARCHAR(45),
    server_port INTEGER,
    max_players INTEGER,
    discord_invite VARCHAR(255),
    website_url VARCHAR(255),
    mod_list TEXT,
    server_rules TEXT,
    contact_info VARCHAR(255),
    additional_info TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    featured BOOLEAN DEFAULT FALSE,
    listing_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_server_registration_tickets_status ON server_registration_tickets(status);
CREATE INDEX IF NOT EXISTS idx_server_registration_tickets_tier ON server_registration_tickets(tier);
CREATE INDEX IF NOT EXISTS idx_server_registration_tickets_guild ON server_registration_tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_server_listings_tier ON server_listings(tier);
CREATE INDEX IF NOT EXISTS idx_server_listings_active ON server_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_server_listings_featured ON server_listings(featured);
