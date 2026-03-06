-- ═══════════════════════════════════════════════════════════════════
-- DEFINITIVE FIX: Branch Management RLS — Run in Supabase SQL Editor
-- This drops ALL existing branch policies and creates clean, simple ones.
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Drop ALL existing policies on branches (clean slate)
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'branches' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON branches', pol.policyname);
    END LOOP;
END $$;

-- Step 2: Also drop all policies on users table and recreate
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
    END LOOP;
END $$;

-- Step 3: Recreate helper functions with SECURITY DEFINER + SET search_path
-- This ensures they bypass RLS when reading from 'users' internally
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
DECLARE v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.users
    JOIN public.roles ON users.role_id = roles.id
    WHERE users.id = auth.uid()
      AND roles.name IN ('SUPER_ADMIN', 'ADMIN')
  ) INTO v_is_admin;
  RETURN COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION current_user_branch_id() RETURNS UUID AS $$
DECLARE v_branch_id UUID;
BEGIN
  SELECT branch_id INTO v_branch_id FROM public.users WHERE id = auth.uid();
  RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: BRANCHES — Simple policies (NO recursion possible)
-- Everyone authenticated can READ branches (no function call needed)
CREATE POLICY "branches_select" ON branches
    FOR SELECT TO authenticated
    USING (true);

-- Only admins can INSERT/UPDATE/DELETE branches
CREATE POLICY "branches_insert" ON branches
    FOR INSERT TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "branches_update" ON branches
    FOR UPDATE TO authenticated
    USING (is_admin());

CREATE POLICY "branches_delete" ON branches
    FOR DELETE TO authenticated
    USING (is_admin());

-- Step 5: USERS — Simple policies (no FOR ALL to avoid recursion)
-- Users can read their own row + users in same branch
CREATE POLICY "users_select_own" ON users
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "users_select_branch" ON users
    FOR SELECT TO authenticated
    USING (branch_id = current_user_branch_id());

CREATE POLICY "users_admin_select" ON users
    FOR SELECT TO authenticated
    USING (is_admin());

CREATE POLICY "users_admin_insert" ON users
    FOR INSERT TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "users_admin_update" ON users
    FOR UPDATE TO authenticated
    USING (is_admin());

CREATE POLICY "users_admin_delete" ON users
    FOR DELETE TO authenticated
    USING (is_admin());

-- Verify: List all policies on branches
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies WHERE tablename IN ('branches', 'users')
ORDER BY tablename, policyname;
