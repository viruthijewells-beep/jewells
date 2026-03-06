-- ═══════════════════════════════════════════════════════════════════
-- 📈 GOLD RATE HISTORY — Automatic tracking of rate changes
-- Run this in Supabase SQL Editor AFTER gold_settings_migration.sql
-- ═══════════════════════════════════════════════════════════════════

-- History table
CREATE TABLE IF NOT EXISTS gold_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate NUMERIC(10,2) NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by UUID REFERENCES users(id)
);

-- Seed with current rate as first history entry
INSERT INTO gold_rate_history (rate, changed_at)
SELECT current_rate, COALESCE(last_updated_at, now())
FROM gold_settings
LIMIT 1;

-- Auto-log trigger: every gold_settings UPDATE inserts a history row
CREATE OR REPLACE FUNCTION log_gold_rate_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_rate IS DISTINCT FROM NEW.current_rate THEN
    INSERT INTO gold_rate_history (rate, changed_at, changed_by)
    VALUES (NEW.current_rate, NEW.last_updated_at, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gold_rate_history_trigger
  AFTER UPDATE ON gold_settings
  FOR EACH ROW
  EXECUTE FUNCTION log_gold_rate_change();

-- RLS: anyone can read history
ALTER TABLE gold_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gold rate history"
  ON gold_rate_history FOR SELECT
  USING (true);
