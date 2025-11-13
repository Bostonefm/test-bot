
-- Ticket Analytics Tables for Automated Reporting
CREATE TABLE IF NOT EXISTS ticket_analytics (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  tickets_created INTEGER DEFAULT 0,
  tickets_closed INTEGER DEFAULT 0,
  avg_response_time INTERVAL,
  total_messages INTEGER DEFAULT 0,
  active_staff_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, date)
);

-- Automated response time tracking
CREATE TABLE IF NOT EXISTS response_times (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  staff_user_id VARCHAR(20) NOT NULL,
  response_time INTERVAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
);

-- Auto-generate daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update analytics when ticket status changes
  INSERT INTO ticket_analytics (guild_id, tickets_created, tickets_closed)
  VALUES (
    COALESCE(NEW.guild_id, OLD.guild_id),
    CASE WHEN NEW.status = 'open' AND (OLD.status IS NULL OR OLD.status != 'open') THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN 1 ELSE 0 END
  )
  ON CONFLICT (guild_id, date) 
  DO UPDATE SET
    tickets_created = ticket_analytics.tickets_created + EXCLUDED.tickets_created,
    tickets_closed = ticket_analytics.tickets_closed + EXCLUDED.tickets_closed;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS ticket_analytics_trigger ON tickets;
CREATE TRIGGER ticket_analytics_trigger
  AFTER INSERT OR UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_daily_analytics();

-- Trigger for automated analytics
DROP TRIGGER IF EXISTS ticket_analytics_trigger ON tickets;
CREATE TRIGGER ticket_analytics_trigger
  AFTER INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_analytics();
