-- ═══════════════════════════════════════════════════════════════════
-- 🔧 GOLD SETTINGS — PERMISSION FIX
-- Run this in Supabase SQL Editor to fix access issues.
-- ═══════════════════════════════════════════════════════════════════

-- Grant table-level access to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE ON gold_settings TO anon, authenticated;
GRANT SELECT, INSERT ON gold_rate_history TO anon, authenticated;

-- Verify the row exists
SELECT * FROM gold_settings;
