
-- Create dynamic event settings table
CREATE TABLE IF NOT EXISTS dynamic_event_settings (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  show_location BOOLEAN DEFAULT TRUE,
  custom_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, event_type)
);

-- Insert default settings for all event types
INSERT INTO dynamic_event_settings (guild_id, event_type, enabled, show_location, custom_name)
SELECT DISTINCT 
  nc.guild_id,
  unnest(ARRAY[
    'StaticAirplaneCrate', 'StaticBoatFishing', 'StaticBoatMilitary',
    'StaticBonfire', 'StaticChristmasTree', 'StaticContainerLocked',
    'StaticHeliCrash', 'StaticMilitaryConvoy', 'StaticPoliceSituation', 'StaticTrain'
  ]) as event_type,
  TRUE as enabled,
  TRUE as show_location,
  NULL as custom_name
FROM nitrado_creds nc
WHERE nc.guild_id IS NOT NULL
ON CONFLICT (guild_id, event_type) DO NOTHING;
