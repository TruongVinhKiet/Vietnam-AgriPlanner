-- Add harvest timing columns for timed harvest feature
ALTER TABLE fields ADD COLUMN IF NOT EXISTS harvesting_started_at TIMESTAMP;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS harvesting_duration_minutes INTEGER DEFAULT 0;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS harvesting_machinery_id BIGINT;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS harvesting_cost DECIMAL(15,2);
