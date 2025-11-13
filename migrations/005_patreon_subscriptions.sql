
-- migrations/005_patreon_subscriptions.sql
-- Patreon subscription tracking

CREATE TABLE IF NOT EXISTS patreon_subscriptions (
    discord_id VARCHAR(20) PRIMARY KEY,
    patreon_email VARCHAR(255),
    subscription_tier VARCHAR(20) NOT NULL,
    active BOOLEAN DEFAULT true,
    verified_at TIMESTAMP DEFAULT NOW(),
    verified_by VARCHAR(20),
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_by VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patreon_verification_requests (
    discord_id VARCHAR(20) PRIMARY KEY,
    patreon_email VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP DEFAULT NOW(),
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    processed_by VARCHAR(20),
    notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patreon_subscriptions_active ON patreon_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_patreon_subscriptions_tier ON patreon_subscriptions(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_patreon_verification_pending ON patreon_verification_requests(processed) WHERE NOT processed;

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(user_discord_id VARCHAR(20))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM patreon_subscriptions 
        WHERE discord_id = user_discord_id 
        AND active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql;
