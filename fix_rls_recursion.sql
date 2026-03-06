-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: RLS RECURSIVE LOOP — Run this in Supabase SQL Editor
-- The is_admin() and current_user_branch_id() functions query the 'users'
-- table, but the 'users' table has RLS policies that call is_admin()
-- causing infinite recursion. This fix uses SET search_path and
-- bypasses RLS inside the helper functions.
-- ═══════════════════════════════════════════════════════════════════════════

-- Fix 1: Recreate is_admin() to bypass RLS on the users table
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Use a direct query bypassing RLS (SECURITY DEFINER runs as the function owner)
  SELECT EXISTS (
    SELECT 1 FROM public.users
    JOIN public.roles ON users.role_id = roles.id
    WHERE users.id = auth.uid()
      AND roles.name IN ('SUPER_ADMIN', 'ADMIN')
  ) INTO v_is_admin;
  RETURN COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix 2: Recreate current_user_branch_id() to bypass RLS
CREATE OR REPLACE FUNCTION current_user_branch_id() RETURNS UUID AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT branch_id INTO v_branch_id FROM public.users WHERE id = auth.uid();
  RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix 3: Also add RLS policies for tables that were missing
-- gold_settings (seen in console errors)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gold_settings') THEN
    ALTER TABLE gold_settings ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "gold_settings_read" ON gold_settings';
    EXECUTE 'CREATE POLICY "gold_settings_read" ON gold_settings FOR SELECT TO authenticated USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "gold_settings_admin" ON gold_settings';
    EXECUTE 'CREATE POLICY "gold_settings_admin" ON gold_settings FOR ALL USING (is_admin())';
  END IF;
END $$;

-- gold_rate_history
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gold_rate_history') THEN
    ALTER TABLE gold_rate_history ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "gold_rate_read" ON gold_rate_history';
    EXECUTE 'CREATE POLICY "gold_rate_read" ON gold_rate_history FOR SELECT TO authenticated USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "gold_rate_admin" ON gold_rate_history';
    EXECUTE 'CREATE POLICY "gold_rate_admin" ON gold_rate_history FOR ALL USING (is_admin())';
  END IF;
END $$;

-- suppliers
DO $$
BEGIN
  DROP POLICY IF EXISTS "super_admin_all_suppliers" ON suppliers;
  DROP POLICY IF EXISTS "staff_read_suppliers" ON suppliers;
  CREATE POLICY "super_admin_all_suppliers" ON suppliers FOR ALL USING (is_admin());
  CREATE POLICY "staff_read_suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
END $$;
