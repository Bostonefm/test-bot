CREATE TABLE IF NOT EXISTS guild_feed_settings (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    feed_name TEXT NOT NULL,
    visibility TEXT DEFAULT 'public',
    show_location BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (guild_id, feed_name)
);
