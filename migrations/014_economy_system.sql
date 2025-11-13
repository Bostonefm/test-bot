
-- Economy System Tables
CREATE TABLE IF NOT EXISTS economy_accounts (
    discord_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    balance BIGINT DEFAULT 0 CHECK (balance >= 0),
    total_earned BIGINT DEFAULT 0,
    total_spent BIGINT DEFAULT 0,
    last_daily TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (discord_id, guild_id)
);

CREATE TABLE IF NOT EXISTS economy_transactions (
    transaction_id SERIAL PRIMARY KEY,
    discord_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    amount BIGINT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'daily', 'kill_reward', 'activity', 'transfer_in', 'transfer_out', 'shop_purchase', 'bounty_place', 'bounty_claim'
    description TEXT,
    metadata JSONB, -- Store additional data like kill details, item purchased, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (discord_id, guild_id) REFERENCES economy_accounts(discord_id, guild_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_economy_transactions_user ON economy_transactions(discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_type ON economy_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_created ON economy_transactions(created_at);

-- Economy Settings per Guild
CREATE TABLE IF NOT EXISTS economy_settings (
    guild_id VARCHAR(20) PRIMARY KEY,
    daily_reward BIGINT DEFAULT 100,
    kill_reward BIGINT DEFAULT 25,
    activity_reward BIGINT DEFAULT 5,
    activity_interval INTEGER DEFAULT 300, -- seconds between activity rewards
    max_transfer BIGINT DEFAULT 10000,
    currency_name VARCHAR(50) DEFAULT 'Grizzly Coins',
    currency_symbol VARCHAR(10) DEFAULT 'GC',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
