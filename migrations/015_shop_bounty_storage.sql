
-- Shop System Tables
CREATE TABLE IF NOT EXISTS shop_categories (
    category_id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    category_description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, category_name)
);

CREATE TABLE IF NOT EXISTS shop_items (
    item_id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    category_id INTEGER REFERENCES shop_categories(category_id) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    item_description TEXT,
    price BIGINT NOT NULL CHECK (price > 0),
    stock_quantity INTEGER, -- NULL = unlimited stock
    max_per_user INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, item_name)
);

CREATE TABLE IF NOT EXISTS shop_purchases (
    purchase_id SERIAL PRIMARY KEY,
    discord_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    item_id INTEGER REFERENCES shop_items(item_id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    total_cost BIGINT NOT NULL,
    purchased_at TIMESTAMP DEFAULT NOW(),
    fulfillment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'fulfilled', 'cancelled'
    fulfillment_notes TEXT
);

-- Bounty System Tables
CREATE TABLE IF NOT EXISTS bounties (
    bounty_id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    target_discord_id VARCHAR(20) NOT NULL,
    target_ingame_name VARCHAR(100) NOT NULL,
    placed_by_discord_id VARCHAR(20) NOT NULL,
    reward_amount BIGINT NOT NULL CHECK (reward_amount > 0),
    bounty_reason TEXT,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'claimed', 'expired', 'cancelled'
    placed_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    claimed_by_discord_id VARCHAR(20),
    claimed_at TIMESTAMP,
    proof_url TEXT, -- Screenshot/video evidence
    admin_verified BOOLEAN DEFAULT FALSE,
    verification_notes TEXT
);

-- Kill Logs Storage (Enhanced)
CREATE TABLE IF NOT EXISTS kill_logs (
    kill_id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    killer_name VARCHAR(100),
    killer_discord_id VARCHAR(20), -- If linked
    victim_name VARCHAR(100),
    victim_discord_id VARCHAR(20), -- If linked
    weapon VARCHAR(100),
    distance DECIMAL(10,2),
    location_x DECIMAL(10,2),
    location_y DECIMAL(10,2),
    grid_reference VARCHAR(10),
    timestamp TIMESTAMP NOT NULL,
    server_restart_id INTEGER, -- Group kills by server session
    raw_log_line TEXT, -- Original log entry
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shop_items_guild_category ON shop_items(guild_id, category_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_user ON shop_purchases(discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_kill_logs_timestamp ON kill_logs(guild_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_kill_logs_participants ON kill_logs(killer_discord_id, victim_discord_id);
