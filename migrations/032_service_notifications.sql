-- Migration: Add service_notifications table for Nitrado maintenance and issue tracking
-- Created: 2025-10-15

CREATE TABLE IF NOT EXISTS service_notifications (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    notification_id INTEGER,
    type VARCHAR(100),
    level VARCHAR(20),
    error_id VARCHAR(100),
    dismissed BOOLEAN DEFAULT FALSE,
    message TEXT,
    message_long TEXT,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL,
    created_at_timestamp BIGINT,
    lifetime INTEGER,
    discord_alerted BOOLEAN DEFAULT FALSE,
    discord_alert_time TIMESTAMP,
    UNIQUE(service_id, notification_id)
);

-- Index for quick lookups by guild and service
CREATE INDEX IF NOT EXISTS idx_service_notifications_guild ON service_notifications(guild_id);
CREATE INDEX IF NOT EXISTS idx_service_notifications_service ON service_notifications(service_id);
CREATE INDEX IF NOT EXISTS idx_service_notifications_level ON service_notifications(level) WHERE NOT dismissed;
CREATE INDEX IF NOT EXISTS idx_service_notifications_created ON service_notifications(created_at DESC);

-- Index for finding un-alerted critical notifications
CREATE INDEX IF NOT EXISTS idx_service_notifications_alert 
ON service_notifications(level, discord_alerted) 
WHERE level IN ('SEVERE', 'WARNING') AND NOT discord_alerted;

COMMENT ON TABLE service_notifications IS 'Stores Nitrado service notifications for maintenance windows, errors, and warnings';
COMMENT ON COLUMN service_notifications.level IS 'Severity: SEVERE, WARNING, INFO, SUCCESS, DEBUG';
COMMENT ON COLUMN service_notifications.discord_alerted IS 'TRUE if Discord notification sent';
