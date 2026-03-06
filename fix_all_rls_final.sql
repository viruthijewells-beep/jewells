-- ═══════════════════════════════════════════════════════════════════
-- FIX: Sales & Sale Items RLS — Run in Supabase SQL Editor
-- Ensures Reports page can read sales data without recursion
-- ═══════════════════════════════════════════════════════════════════

-- Drop old policies on sales
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'sales' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sales', pol.policyname);
    END LOOP;
END $$;

-- Drop old policies on sale_items
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'sale_items' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sale_items', pol.policyname);
    END LOOP;
END $$;

-- SALES: admins can read all, managers see own branch
CREATE POLICY "sales_admin_select" ON sales FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "sales_branch_select" ON sales FOR SELECT TO authenticated USING (branch_id = current_user_branch_id());
CREATE POLICY "sales_admin_insert" ON sales FOR INSERT TO authenticated WITH CHECK (is_admin() OR branch_id = current_user_branch_id());
CREATE POLICY "sales_admin_update" ON sales FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "sales_admin_delete" ON sales FOR DELETE TO authenticated USING (is_admin());

-- SALE_ITEMS: admins read all, others via sales join
CREATE POLICY "sale_items_admin_select" ON sale_items FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "sale_items_branch_select" ON sale_items FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.branch_id = current_user_branch_id()));
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sale_items_admin_update" ON sale_items FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "sale_items_admin_delete" ON sale_items FOR DELETE TO authenticated USING (is_admin());

-- Also fix remaining tables that might have FOR ALL policies
-- stock_history
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'stock_history' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON stock_history', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "stock_history_admin" ON stock_history FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "stock_history_branch" ON stock_history FOR SELECT TO authenticated USING (branch_id = current_user_branch_id());
CREATE POLICY "stock_history_insert" ON stock_history FOR INSERT TO authenticated WITH CHECK (true);

-- branch_inventory
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'branch_inventory' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON branch_inventory', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "inventory_admin" ON branch_inventory FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "inventory_branch" ON branch_inventory FOR SELECT TO authenticated USING (branch_id = current_user_branch_id());
CREATE POLICY "inventory_write" ON branch_inventory FOR INSERT TO authenticated WITH CHECK (is_admin() OR branch_id = current_user_branch_id());
CREATE POLICY "inventory_update" ON branch_inventory FOR UPDATE TO authenticated USING (is_admin() OR branch_id = current_user_branch_id());

-- products & categories: readable by all
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'products' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON products', pol.policyname);
    END LOOP;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'categories' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON categories', pol.policyname);
    END LOOP;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'roles' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON roles', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "products_read" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_admin_write" ON products FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "products_admin_update" ON products FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "products_admin_delete" ON products FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "categories_read" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_admin_write" ON categories FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "categories_admin_update" ON categories FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "categories_admin_delete" ON categories FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "roles_read" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON roles FOR INSERT TO authenticated WITH CHECK (is_admin());

-- Verify
SELECT tablename, policyname, cmd, qual FROM pg_policies
WHERE tablename IN ('sales', 'sale_items', 'stock_history', 'branch_inventory', 'products', 'categories', 'roles')
ORDER BY tablename, policyname;
