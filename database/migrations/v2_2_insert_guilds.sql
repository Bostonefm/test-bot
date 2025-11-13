-- ======================================================
-- 🧩 Grizzly DB Migration — v2.2 (Base Guild Seeding)
-- Ensures core authorized guilds exist across all bots
-- ======================================================

-- Create missing columns (safety)
ALTER TABLE IF EXISTS grizzly_authorized_guilds
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'none';

-- Upsert (insert if not exists)
INSERT INTO grizzly_authorized_guilds (guild_id, guild_name, authorized, tier, updated_at)
VALUES
('1428086849456312431', 'Grizzly Test Server', TRUE, 'gold', NOW()),
('1386839632011984916', 'Grizzly Command Central', TRUE, 'gold', NOW())
ON CONFLICT (guild_id) DO UPDATE
SET authorized = EXCLUDED.authorized,
    tier = EXCLUDED.tier,
    updated_at = NOW();
