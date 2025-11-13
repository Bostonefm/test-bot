
-- 004_create_subscriptions.sql

-- (Re-)create the subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  discord_id   TEXT          NOT NULL,
  guild_id     TEXT          NOT NULL,
  tier_name    TEXT          NOT NULL,
  start_date   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  end_date     TIMESTAMPTZ,
  PRIMARY KEY (discord_id, guild_id)
);

-- Simple index on guild_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_guild
  ON subscriptions(guild_id);
