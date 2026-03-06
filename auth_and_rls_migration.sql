-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1: ROW LEVEL SECURITY & AUTH MIGRATION
-- Run this in the Supabase SQL Editor
-- This implements the Multi-Branch Role System with strict data isolation.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ensure 'users' table is prepared for Supabase Auth JWTs. 
-- We drop the 'password' column since Supabase auth.users manages passwords.
-- CASCADE is used because views like 'users_with_roles' and functions like 'authenticate_user' depend on it.
ALTER TABLE users DROP COLUMN IF EXISTS password CASCADE;

-- Recreate the users_with_roles view WITHOUT the password column
CREATE OR REPLACE VIEW users_with_roles AS
SELECT 
    u.id,
    u.name,
    u.email,
    r.name as role,
    b.name as branch_name,
    u.branch_id,
    u.created_at
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN branches b ON u.branch_id = b.id;

-- Recreate authenticate_user function to just return an error since we use actual Supabase Auth now
CREATE OR REPLACE FUNCTION authenticate_user(user_email TEXT, user_password TEXT)
RETURNS JSON AS $$
BEGIN
    RETURN json_build_object('error', 'Authentication system has been upgraded to Supabase Auth. Please use formal signin methods.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Since existing data might have random UUIDs, if we want to enforce it we would
-- add a foreign key constraint. For an existing dev DB, we avoid breaking foreign keys
-- in this script, but recommend doing so if starting fresh.

-- 2. Drop all old permissive policies (from the initial "allow_all" setup)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT tablename, policyname FROM pg_policies WHERE policyname = 'allow_all' OR policyname LIKE '%_admin' OR policyname = 'branches_select_all'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;

-- 3. ENABLE RLS (Ensure it's enabled everywhere)
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items       ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS FOR RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper function to check if the current user is a Super Admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    JOIN roles ON users.role_id = roles.id
    WHERE users.id = auth.uid()
      AND roles.name IN ('SUPER_ADMIN', 'ADMIN')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get the current user's branch_id
CREATE OR REPLACE FUNCTION current_user_branch_id() RETURNS UUID AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT branch_id INTO v_branch_id FROM users WHERE id = auth.uid();
  RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- GLOBAL ACCESS (EVERYONE READS)
-- Products, Categories, Roles, Branches are readable by all authenticated staff
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "super_admin_all_roles" ON roles FOR ALL USING (is_admin());
CREATE POLICY "staff_read_roles" ON roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "super_admin_all_categories" ON categories FOR ALL USING (is_admin());
CREATE POLICY "staff_read_categories" ON categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "super_admin_all_products" ON products FOR ALL USING (is_admin());
CREATE POLICY "staff_read_products" ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "super_admin_all_branches" ON branches FOR ALL USING (is_admin());
CREATE POLICY "staff_read_branches" ON branches FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- ISOLATED DATA POLICIES (MANAGERS SEE ONLY THEIR BRANCH)
-- ═══════════════════════════════════════════════════════════════════════════

-- USERS TABLE
CREATE POLICY "super_admin_all_users" ON users FOR ALL USING (is_admin());
CREATE POLICY "managers_read_own_branch_users" ON users FOR SELECT TO authenticated
USING (
    branch_id = current_user_branch_id() OR id = auth.uid()
);

-- BRANCH_INVENTORY
CREATE POLICY "super_admin_all_inventory" ON branch_inventory FOR ALL USING (is_admin());
CREATE POLICY "manager_branch_inventory" ON branch_inventory FOR ALL TO authenticated
USING (
    branch_id = current_user_branch_id()
);

-- STOCK_HISTORY
CREATE POLICY "super_admin_all_stock_hist" ON stock_history FOR ALL USING (is_admin());
CREATE POLICY "manager_branch_stock_hist" ON stock_history FOR ALL TO authenticated
USING (
    branch_id = current_user_branch_id()
);

-- POS_SESSIONS
CREATE POLICY "super_admin_all_sessions" ON pos_sessions FOR ALL USING (is_admin());
CREATE POLICY "manager_branch_sessions" ON pos_sessions FOR ALL TO authenticated
USING (
    branch_id = current_user_branch_id()
);

-- SALES
CREATE POLICY "super_admin_all_sales" ON sales FOR ALL USING (is_admin());
CREATE POLICY "manager_branch_sales" ON sales FOR ALL TO authenticated
USING (
    branch_id = current_user_branch_id()
);

-- SALE_ITEMS
-- Note: sale_items doesn't have a branch_id, so we join through sales
CREATE POLICY "super_admin_all_sale_items" ON sale_items FOR ALL USING (is_admin());
CREATE POLICY "manager_branch_sale_items" ON sale_items FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sales 
        WHERE sales.id = sale_items.sale_id 
        AND sales.branch_id = current_user_branch_id()
    )
);

-- AUDIT_LOGS
CREATE POLICY "super_admin_all_audit" ON audit_logs FOR ALL USING (is_admin());
CREATE POLICY "manager_branch_audit" ON audit_logs FOR SELECT TO authenticated
USING (
    branch_id = current_user_branch_id()
);

-- TRANSFERS
CREATE POLICY "super_admin_all_transfers" ON transfers FOR ALL USING (is_admin());
CREATE POLICY "manager_branch_transfers" ON transfers FOR ALL TO authenticated
USING (
    source_branch_id = current_user_branch_id() OR dest_branch_id = current_user_branch_id()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SUPER ADMIN SEEDING IN AUTH LOGIC
-- To link your existing users to Supabase Auth, you will need to:
-- 1. Sign up a new user via the dashboard/app with viruthijewells@gmail.com
-- 2. Update the public.users table to match that new UUID.
-- For now, the Edge Function will handle creating users properly!
-- ═══════════════════════════════════════════════════════════════════════════
