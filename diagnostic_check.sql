-- ============================================================
-- VIRUDTI JEWELLS ERP — Full Backend Diagnostic Check
-- Run this in Supabase SQL Editor to verify all constraints,
-- tables, triggers, and transfer logic are working correctly.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1. CHECK ALL REQUIRED TABLES EXIST
-- ─────────────────────────────────────────────────────────
SELECT 
    table_name,
    CASE WHEN table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
      'products', 'branches', 'branch_inventory',
      'transfers', 'stock_history', 'users',
      'categories', 'sales', 'audit_logs'
  )
ORDER BY table_name;

-- ─────────────────────────────────────────────────────────
-- 2. CHECK UNIQUE CONSTRAINTS ON branch_inventory
-- ─────────────────────────────────────────────────────────
SELECT
    conname AS constraint_name,
    CASE WHEN conname IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'branch_inventory'::regclass
  AND contype IN ('u', 'p')
ORDER BY conname;

-- ─────────────────────────────────────────────────────────
-- 3. CHECK NOT NULL COLUMNS ON branch_inventory
-- ─────────────────────────────────────────────────────────
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE WHEN is_nullable = 'NO' THEN '🔒 NOT NULL' ELSE '✔ nullable' END AS constraint_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'branch_inventory'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────
-- 4. CHECK TRIGGERS ON branch_inventory
-- ─────────────────────────────────────────────────────────
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'branch_inventory'
ORDER BY trigger_name;

-- ─────────────────────────────────────────────────────────
-- 5. VERIFY BRANCHES EXIST
-- ─────────────────────────────────────────────────────────
SELECT 
    id,
    name,
    city,
    status,
    created_at::date AS created
FROM branches
ORDER BY created_at;

-- ─────────────────────────────────────────────────────────
-- 6. VERIFY BRANCH INVENTORY (stock counts)
-- ─────────────────────────────────────────────────────────
SELECT
    b.name AS branch,
    p.name AS product,
    bi.sku,
    bi.barcode,
    bi.stock_count,
    bi.selling_price
FROM branch_inventory bi
JOIN branches b ON b.id = bi.branch_id
JOIN products p ON p.id = bi.product_id
ORDER BY b.name, p.name;

-- ─────────────────────────────────────────────────────────
-- 7. CHECK FOR DUPLICATE BARCODES PER BRANCH (should be 0)
-- ─────────────────────────────────────────────────────────
SELECT
    branch_id,
    barcode,
    COUNT(*) AS duplicate_count,
    CASE WHEN COUNT(*) > 1 THEN '❌ DUPLICATE' ELSE '✅ OK' END AS status
FROM branch_inventory
WHERE barcode IS NOT NULL
GROUP BY branch_id, barcode
HAVING COUNT(*) > 1;

-- If empty result → ✅ No duplicate barcodes

-- ─────────────────────────────────────────────────────────
-- 8. CHECK TRANSFERS TABLE — ACTUAL COLUMN NAMES
-- ─────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transfers'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────
-- 8B. SHOW TRANSFER HISTORY (raw — no joins)
-- ─────────────────────────────────────────────────────────
SELECT * FROM transfers
ORDER BY created_at DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────
-- 9. CHECK STOCK HISTORY — ACTUAL COLUMNS
-- ─────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stock_history'
ORDER BY ordinal_position;

-- 9B. STOCK HISTORY RECENT RECORDS (raw)
SELECT * FROM stock_history
ORDER BY created_at DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────
-- 10. SIMULATE TRANSFER VALIDATION (dry run, no changes)
-- Tests: can we safely transfer 1 unit from branch A to B?
-- ─────────────────────────────────────────────────────────
-- Step 1: Find a valid source row with stock > 0
SELECT
    bi.id AS source_inventory_id,
    b.name AS branch_name,
    p.name AS product_name,
    bi.stock_count,
    bi.sku,
    bi.barcode,
    CASE WHEN bi.stock_count > 0 THEN '✅ CAN TRANSFER' ELSE '❌ NO STOCK' END AS transfer_status
FROM branch_inventory bi
JOIN branches b ON b.id = bi.branch_id
JOIN products p ON p.id = bi.product_id
WHERE bi.stock_count > 0
ORDER BY bi.stock_count DESC
LIMIT 5;

-- ─────────────────────────────────────────────────────────
-- 11. AUDIT LOGS CHECK
-- ─────────────────────────────────────────────────────────
SELECT
    al.action,
    al.details,
    u.name AS user_name,
    al.created_at
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
ORDER BY al.created_at DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────
-- 12. OVERALL HEALTH SUMMARY
-- ─────────────────────────────────────────────────────────
SELECT 
    'Branches'         AS entity, COUNT(*) AS total FROM branches
UNION ALL
SELECT 'Products',       COUNT(*) FROM products
UNION ALL
SELECT 'Inventory Rows', COUNT(*) FROM branch_inventory
UNION ALL
SELECT 'Transfers Done', COUNT(*) FROM transfers
UNION ALL
SELECT 'Stock History',  COUNT(*) FROM stock_history
UNION ALL
SELECT 'Audit Logs',     COUNT(*) FROM audit_logs
UNION ALL
SELECT 'Users',          COUNT(*) FROM users;
