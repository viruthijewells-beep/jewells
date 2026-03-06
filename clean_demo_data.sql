-- ═══════════════════════════════════════════════════════════════════════
-- 🧹 VIRUDTI JEWELLS - DEMO DATA CLEANUP SCRIPT
-- Run this in the Supabase SQL Editor to wipe all sample data
-- while preserving core system configurations.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN; -- Start transaction for safety

-- 1. Clear all transactions, sales, and sessions
-- Note: CASCADE takes care of linked records where configured, 
-- but explicit deletes ensure clean removal across all tables.
TRUNCATE TABLE sale_items CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE pos_sessions CASCADE;
TRUNCATE TABLE transfers CASCADE;

-- 2. Clear all inventory and products
-- Truncating products will CASCADE to branch_inventory and stock_history
TRUNCATE TABLE stock_history CASCADE;
TRUNCATE TABLE branch_inventory CASCADE;
TRUNCATE TABLE products CASCADE;

-- 3. Clear all audit logs
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE sys_audit_trails CASCADE;

-- 4. Delete demo users (Keep Super Admins)
-- This deletes any users that don't have the ADMIN role
DELETE FROM users 
WHERE role_id NOT IN (
    SELECT id FROM roles WHERE name = 'ADMIN'
);

-- Optional: Ensure specific admin email is retained just in case
-- (The above query should already protect all admins)

-- ═══════════════════════════════════════════════════════════════════════
-- ✅ WHAT WAS KEPT:
-- - roles (Admin, Manager, HQ)
-- - branches (Madurai, etc.)
-- - categories (Ring, Necklace, etc.)
-- - gold_settings (Current rate)
-- - admins (viruthijewells@gmail.com)
-- ═══════════════════════════════════════════════════════════════════════

COMMIT; -- Commit the changes
