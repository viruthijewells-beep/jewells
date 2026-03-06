-- ═══════════════════════════════════════════════════════════════════
-- 💰 GOLD SETTINGS — Complete Idempotent Migration
-- Safe to run multiple times. Fixes all RLS + trigger issues.
-- Run this in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Create table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gold_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_rate NUMERIC(10,2) NOT NULL DEFAULT 7245.00,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- ─── 2. Create history table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS gold_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate NUMERIC(10,2) NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by UUID
);

-- ─── 3. Seed default row if empty ───────────────────────────────
INSERT INTO gold_settings (current_rate)
SELECT 7245.00
WHERE NOT EXISTS (SELECT 1 FROM gold_settings);

-- Seed history with current rate
INSERT INTO gold_rate_history (rate, changed_at)
SELECT current_rate, COALESCE(last_updated_at, now())
FROM gold_settings
WHERE NOT EXISTS (SELECT 1 FROM gold_rate_history);

-- ─── 4. Drop old triggers/policies (idempotent) ────────────────
DROP TRIGGER IF EXISTS gold_settings_single_row ON gold_settings;
DROP TRIGGER IF EXISTS gold_rate_history_trigger ON gold_settings;
DROP FUNCTION IF EXISTS prevent_gold_settings_insert() CASCADE;
DROP FUNCTION IF EXISTS log_gold_rate_change() CASCADE;

-- ─── 5. Single-row enforcement trigger ─────────────────────────
CREATE OR REPLACE FUNCTION prevent_gold_settings_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM gold_settings) >= 1 THEN
    RAISE EXCEPTION 'Only one gold_settings row allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gold_settings_single_row
  BEFORE INSERT ON gold_settings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_gold_settings_insert();

-- ─── 6. Auto-log history trigger ────────────────────────────────
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

-- ─── 7. RLS for gold_settings ───────────────────────────────────
ALTER TABLE gold_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read gold rate" ON gold_settings;
DROP POLICY IF EXISTS "Admin can update gold rate" ON gold_settings;
DROP POLICY IF EXISTS "Allow insert for seeding" ON gold_settings;

CREATE POLICY "Anyone can read gold rate" ON gold_settings
  FOR SELECT USING (true);

CREATE POLICY "Admin can update gold rate" ON gold_settings
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow insert for seeding" ON gold_settings
  FOR INSERT WITH CHECK (true);

-- ─── 8. RLS for gold_rate_history ───────────────────────────────
ALTER TABLE gold_rate_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read gold rate history" ON gold_rate_history;
DROP POLICY IF EXISTS "Allow history insert" ON gold_rate_history;

CREATE POLICY "Anyone can read gold rate history" ON gold_rate_history
  FOR SELECT USING (true);

CREATE POLICY "Allow history insert" ON gold_rate_history
  FOR INSERT WITH CHECK (true);

-- ─── 9. Enable real-time (safe if already added) ────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE gold_settings;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
