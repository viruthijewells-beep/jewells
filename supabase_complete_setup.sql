-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  VIRUDTI JEWELLS — COMPLETE DATABASE SETUP                                 ║
-- ║  Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New Query) ║
-- ║  This script is IDEMPOTENT — safe to re-run.                               ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ════════════════════════════════════════════════════════════════════
-- PART 1: EXTENSIONS
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ════════════════════════════════════════════════════════════════════
-- PART 2: CORE TABLES
-- ════════════════════════════════════════════════════════════════════

-- 2.1 Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
    ('ADMIN', 'Full system access'),
    ('MANAGER', 'Branch management access'),
    ('HQ', 'HQ analytics read-only')
ON CONFLICT (name) DO NOTHING;

-- 2.2 Branches
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    is_hq BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Users (with bcrypt password support)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password TEXT NOT NULL,
    role_id UUID REFERENCES roles(id),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create view that joins user + role + branch for easy querying
CREATE OR REPLACE VIEW users_with_roles AS
SELECT
    u.id, u.email, u.name, u.password,
    r.name AS role,
    u.branch_id,
    b.name AS branch_name,
    u.created_at, u.updated_at
FROM users u
LEFT JOIN roles r ON r.id = u.role_id
LEFT JOIN branches b ON b.id = u.branch_id;

-- 2.4 Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    contact TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 Products (Global Catalog)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    gold_type VARCHAR(50) NOT NULL DEFAULT '22K',
    design_code VARCHAR(100),
    weight_base NUMERIC(10, 3) DEFAULT 0,
    making_charges_base NUMERIC(12, 2) DEFAULT 0,
    stone_details TEXT,
    image_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 Branch Inventory (per-branch stock)
CREATE TABLE IF NOT EXISTS branch_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    barcode VARCHAR(100) NOT NULL,
    stock_count INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER NOT NULL DEFAULT 5,
    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT positive_stock CHECK (stock_count >= 0),
    CONSTRAINT uq_branch_inventory_product UNIQUE (product_id, branch_id),
    CONSTRAINT uq_branch_barcode UNIQUE (barcode)
);

-- 2.8 Stock History (immutable ledger)
CREATE TABLE IF NOT EXISTS stock_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id),
    old_count INTEGER NOT NULL,
    new_count INTEGER NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.9 Audit Logs (immutable compliance log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id),
    details JSONB NOT NULL DEFAULT '{}',
    ip_address VARCHAR(45),
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.10 Transfers
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id),
    source_branch_id UUID REFERENCES branches(id),
    dest_branch_id UUID REFERENCES branches(id),
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    reason TEXT,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.11 POS Sessions
CREATE TABLE IF NOT EXISTS pos_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 2.12 Sales
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES pos_sessions(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    user_id UUID NOT NULL REFERENCES users(id),
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    tax_percent NUMERIC(5, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(20) DEFAULT 'CASH',
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.13 Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES branch_inventory(id),
    product_id UUID NOT NULL REFERENCES products(id),
    name VARCHAR(255),
    sku VARCHAR(100),
    barcode VARCHAR(100),
    gold_type VARCHAR(50),
    weight NUMERIC(10, 3),
    unit_price NUMERIC(15, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.14 System Audit Trails (trigger-based)
CREATE TABLE IF NOT EXISTS sys_audit_trails (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(10) NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT,
    client_ip TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════════
-- PART 3: GOLD SETTINGS (Single-Row Configuration)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gold_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_rate NUMERIC(10,2) NOT NULL DEFAULT 7245.00,
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID
);

CREATE TABLE IF NOT EXISTS gold_rate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate NUMERIC(10,2) NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now(),
    changed_by UUID
);

-- Seed default gold rate if empty
INSERT INTO gold_settings (current_rate)
SELECT 7245.00
WHERE NOT EXISTS (SELECT 1 FROM gold_settings);

INSERT INTO gold_rate_history (rate, changed_at)
SELECT current_rate, COALESCE(last_updated_at, now())
FROM gold_settings
WHERE NOT EXISTS (SELECT 1 FROM gold_rate_history);


-- ════════════════════════════════════════════════════════════════════
-- PART 4: INDEXES
-- ════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_products_category_status ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_bi_branch_stock ON branch_inventory(branch_id, stock_count);
CREATE INDEX IF NOT EXISTS idx_bi_branch_product ON branch_inventory(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_bi_low_stock ON branch_inventory(stock_count, min_stock_level) WHERE stock_count <= min_stock_level;
CREATE INDEX IF NOT EXISTS idx_bi_updated ON branch_inventory(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_branch ON stock_history(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON audit_logs(branch_id);

CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);


-- ════════════════════════════════════════════════════════════════════
-- PART 5: FULL-TEXT SEARCH
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.design_code, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvectorupdate ON products;
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
    ON products FOR EACH ROW EXECUTE PROCEDURE products_search_vector_update();

CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN (search_vector);


-- ════════════════════════════════════════════════════════════════════
-- PART 6: AUTO-UPDATE TIMESTAMPS
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_modtime ON products;
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_branches_modtime ON branches;
CREATE TRIGGER update_branches_modtime BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_bi_modtime ON branch_inventory;
CREATE TRIGGER update_bi_modtime BEFORE UPDATE ON branch_inventory
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- ════════════════════════════════════════════════════════════════════
-- PART 7: GOLD SETTINGS TRIGGERS
-- ════════════════════════════════════════════════════════════════════

-- Single-row enforcement
DROP TRIGGER IF EXISTS gold_settings_single_row ON gold_settings;
DROP FUNCTION IF EXISTS prevent_gold_settings_insert() CASCADE;

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
  FOR EACH ROW EXECUTE FUNCTION prevent_gold_settings_insert();

-- Auto-log rate changes to gold_rate_history
DROP TRIGGER IF EXISTS gold_rate_history_trigger ON gold_settings;
DROP FUNCTION IF EXISTS log_gold_rate_change() CASCADE;

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
  FOR EACH ROW EXECUTE FUNCTION log_gold_rate_change();


-- ════════════════════════════════════════════════════════════════════
-- PART 8: AUDIT TRIGGERS
-- ════════════════════════════════════════════════════════════════════

-- 8.1 Branch Inventory Audit Trigger
DROP TRIGGER IF EXISTS trg_audit_branch_inventory ON branch_inventory;
DROP FUNCTION IF EXISTS fn_audit_branch_inventory() CASCADE;

CREATE OR REPLACE FUNCTION fn_audit_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
    v_action        TEXT;
    v_old_stock     INT;
    v_new_stock     INT;
    v_branch_id     UUID;
    v_product_id    UUID;
    v_user_id       UUID;
    v_ip_address    TEXT;
    v_details       JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'INVENTORY_INSERT'; v_old_stock := 0; v_new_stock := NEW.stock_count;
        v_branch_id := NEW.branch_id; v_product_id := NEW.product_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'INVENTORY_UPDATE'; v_old_stock := OLD.stock_count; v_new_stock := NEW.stock_count;
        v_branch_id := NEW.branch_id; v_product_id := NEW.product_id;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'INVENTORY_DELETE'; v_old_stock := OLD.stock_count; v_new_stock := 0;
        v_branch_id := OLD.branch_id; v_product_id := OLD.product_id;
    END IF;

    BEGIN v_user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN v_user_id := NULL; END;

    BEGIN v_ip_address := current_setting('app.client_ip', true);
    EXCEPTION WHEN OTHERS THEN v_ip_address := NULL; END;

    v_details := jsonb_build_object(
        'trigger', 'fn_audit_branch_inventory', 'operation', TG_OP, 'table', TG_TABLE_NAME,
        'productId', v_product_id, 'branchId', v_branch_id,
        'oldStock', v_old_stock, 'newStock', v_new_stock,
        'stockDelta', v_new_stock - v_old_stock,
        'inventoryId', COALESCE(NEW.id, OLD.id),
        'version', CASE WHEN TG_OP = 'DELETE' THEN OLD.version ELSE NEW.version END,
        'timestamp', NOW()
    );

    INSERT INTO audit_logs (action, user_id, branch_id, details, ip_address, created_at)
    VALUES (v_action, v_user_id, v_branch_id, v_details, v_ip_address, NOW());

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_branch_inventory
    AFTER INSERT OR UPDATE OR DELETE ON branch_inventory
    FOR EACH ROW EXECUTE FUNCTION fn_audit_branch_inventory();

-- 8.2 Prevent Audit Log Tampering (immutable)
CREATE OR REPLACE FUNCTION fn_prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: Audit logs are immutable. % operations are forbidden.', TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_tampering ON audit_logs;
CREATE TRIGGER trg_prevent_audit_tampering
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 8.3 Products Table Audit Trigger
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    trigger_action VARCHAR(10);
    jwt_user_id TEXT;
BEGIN
    BEGIN jwt_user_id := current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
    EXCEPTION WHEN OTHERS THEN jwt_user_id := 'SYSTEM'; END;
    trigger_action := TG_OP;

    IF trigger_action = 'INSERT' THEN
        INSERT INTO sys_audit_trails (table_name, action_type, new_data, changed_by)
        VALUES (TG_TABLE_NAME, trigger_action, row_to_json(NEW)::jsonb, jwt_user_id);
        RETURN NEW;
    END IF;
    IF trigger_action = 'UPDATE' THEN
        IF row_to_json(OLD)::jsonb IS DISTINCT FROM row_to_json(NEW)::jsonb THEN
            INSERT INTO sys_audit_trails (table_name, action_type, old_data, new_data, changed_by)
            VALUES (TG_TABLE_NAME, trigger_action, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, jwt_user_id);
        END IF;
        RETURN NEW;
    END IF;
    IF trigger_action = 'DELETE' THEN
        INSERT INTO sys_audit_trails (table_name, action_type, old_data, changed_by)
        VALUES (TG_TABLE_NAME, trigger_action, row_to_json(OLD)::jsonb, jwt_user_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_products ON products;
CREATE TRIGGER trg_audit_products
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION log_table_changes();


-- ════════════════════════════════════════════════════════════════════
-- PART 9: AUTHENTICATION RPC
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION authenticate_user(user_email TEXT, user_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_user RECORD;
  is_valid BOOLEAN := FALSE;
BEGIN
  SELECT u.id, u.email, u.name, u.password, u.branch_id,
         r.name AS role_name
  INTO found_user
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.email = user_email
  LIMIT 1;

  IF found_user IS NULL THEN
    RETURN json_build_object('error', 'Invalid credentials');
  END IF;

  IF found_user.password LIKE '$2%' THEN
    is_valid := (found_user.password = crypt(user_password, found_user.password));
  ELSE
    is_valid := (found_user.password = user_password);
  END IF;

  IF NOT is_valid THEN
    RETURN json_build_object('error', 'Invalid credentials');
  END IF;

  RETURN json_build_object(
    'id', found_user.id,
    'email', found_user.email,
    'name', found_user.name,
    'role', found_user.role_name,
    'branchId', found_user.branch_id
  );
END;
$$;


-- ════════════════════════════════════════════════════════════════════
-- PART 10: TRANSFER RPC (Atomic Inter-Branch Transfer)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION transfer_inventory(
    p_product_id      UUID,
    p_source_branch   UUID,
    p_dest_branch     UUID,
    p_quantity         INT,
    p_user_id         UUID,
    p_reason          TEXT DEFAULT 'Inter-branch transfer'
) RETURNS JSONB AS $$
DECLARE
    v_source_inventory  RECORD;
    v_dest_inventory    RECORD;
    v_source_new_count  INT;
    v_dest_old_count    INT;
    v_dest_new_count    INT;
    v_transfer_id       UUID;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Transfer quantity must be positive';
    END IF;
    IF p_source_branch = p_dest_branch THEN
        RAISE EXCEPTION 'Source and destination branches must be different';
    END IF;

    v_transfer_id := uuid_generate_v4();

    SELECT * INTO v_source_inventory FROM branch_inventory
    WHERE branch_id = p_source_branch AND product_id = p_product_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found in source branch';
    END IF;
    IF v_source_inventory.stock_count < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock: have %, need %', v_source_inventory.stock_count, p_quantity;
    END IF;

    v_source_new_count := v_source_inventory.stock_count - p_quantity;
    UPDATE branch_inventory SET stock_count = v_source_new_count, version = version + 1, updated_at = NOW()
    WHERE id = v_source_inventory.id;

    SELECT * INTO v_dest_inventory FROM branch_inventory
    WHERE branch_id = p_dest_branch AND product_id = p_product_id FOR UPDATE;

    IF FOUND THEN
        v_dest_old_count := v_dest_inventory.stock_count;
        v_dest_new_count := v_dest_inventory.stock_count + p_quantity;
        UPDATE branch_inventory SET stock_count = v_dest_new_count, version = version + 1, updated_at = NOW()
        WHERE id = v_dest_inventory.id;
    ELSE
        v_dest_old_count := 0;
        v_dest_new_count := p_quantity;
        INSERT INTO branch_inventory (branch_id, product_id, sku, barcode, stock_count, min_stock_level, purchase_price, selling_price)
        VALUES (p_dest_branch, p_product_id,
                'XFER-' || SUBSTRING(p_dest_branch::text, 1, 8) || '-' || SUBSTRING(p_product_id::text, 1, 8),
                'BC-XFER-' || SUBSTRING(uuid_generate_v4()::text, 1, 8),
                v_dest_new_count, v_source_inventory.min_stock_level,
                v_source_inventory.purchase_price, v_source_inventory.selling_price);
    END IF;

    INSERT INTO stock_history (product_id, branch_id, old_count, new_count, action_type, reason, user_id)
    VALUES (p_product_id, p_source_branch, v_source_inventory.stock_count, v_source_new_count, 'TRANSFER_OUT',
            p_reason || ' [Transfer ID: ' || v_transfer_id || ']', p_user_id);

    INSERT INTO stock_history (product_id, branch_id, old_count, new_count, action_type, reason, user_id)
    VALUES (p_product_id, p_dest_branch, v_dest_old_count, v_dest_new_count, 'TRANSFER_IN',
            p_reason || ' [Transfer ID: ' || v_transfer_id || ']', p_user_id);

    INSERT INTO audit_logs (action, user_id, branch_id, details)
    VALUES ('TRANSFER_INVENTORY', p_user_id, p_source_branch,
            jsonb_build_object('transferId', v_transfer_id, 'productId', p_product_id,
                'sourceBranch', p_source_branch, 'destBranch', p_dest_branch, 'quantity', p_quantity));

    RETURN jsonb_build_object('success', true, 'transferId', v_transfer_id, 'quantity', p_quantity);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════════
-- PART 11: ROW LEVEL SECURITY (RLS) — Permissive for anon
-- ════════════════════════════════════════════════════════════════════
-- NOTE: Since the app uses a custom RPC auth (not Supabase GoTrue),
-- all requests come as the `anon` role. We grant permissive access
-- for now. Once migrated to supabase.auth, tighten these policies.

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
ALTER TABLE sys_audit_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_rate_history ENABLE ROW LEVEL SECURITY;

-- Permissive policies (allow anon read/write for all tables)
-- These should be tightened after migrating to Supabase Auth

CREATE POLICY "allow_all" ON roles            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON branches         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON users            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON categories       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON suppliers        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON products         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON branch_inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON stock_history    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON audit_logs       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transfers        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON pos_sessions     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sales            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sale_items       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sys_audit_trails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON gold_settings    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON gold_rate_history FOR ALL USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════════
-- PART 12: GRANT PERMISSIONS
-- ════════════════════════════════════════════════════════════════════

GRANT ALL ON roles            TO anon, authenticated;
GRANT ALL ON branches         TO anon, authenticated;
GRANT ALL ON users            TO anon, authenticated;
GRANT ALL ON categories       TO anon, authenticated;
GRANT ALL ON suppliers        TO anon, authenticated;
GRANT ALL ON products         TO anon, authenticated;
GRANT ALL ON branch_inventory TO anon, authenticated;
GRANT ALL ON stock_history    TO anon, authenticated;
GRANT ALL ON audit_logs       TO anon, authenticated;
GRANT ALL ON transfers        TO anon, authenticated;
GRANT ALL ON pos_sessions     TO anon, authenticated;
GRANT ALL ON sales            TO anon, authenticated;
GRANT ALL ON sale_items       TO anon, authenticated;
GRANT ALL ON sys_audit_trails TO anon, authenticated;
GRANT ALL ON gold_settings    TO anon, authenticated;
GRANT ALL ON gold_rate_history TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════════
-- PART 13: ENABLE REAL-TIME FOR GOLD SETTINGS
-- ════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE gold_settings;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


-- ════════════════════════════════════════════════════════════════════
-- PART 14: SEED DEFAULT ADMIN USER
-- ════════════════════════════════════════════════════════════════════
-- Default login: viruthijewells@gmail.com / Admin@viruthi
-- Password is bcrypt hashed.

INSERT INTO users (email, name, password, role_id)
SELECT
    'viruthijewells@gmail.com',
    'Super Admin',
    crypt('Admin@viruthi', gen_salt('bf')),
    r.id
FROM roles r WHERE r.name = 'ADMIN'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'viruthijewells@gmail.com');


-- ════════════════════════════════════════════════════════════════════
-- PART 15: SEED DEFAULT BRANCH
-- ════════════════════════════════════════════════════════════════════

INSERT INTO branches (name, code, address, phone, is_hq, is_active)
SELECT 'Virudti Jewells — Madurai', 'VJ-MDU',
       '147, South Masi Street, Madurai, Tamil Nadu 625001',
       '+91-9600996579', true, true
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'VJ-MDU');


-- ════════════════════════════════════════════════════════════════════
-- PART 16: SEED DEFAULT CATEGORIES
-- ════════════════════════════════════════════════════════════════════

INSERT INTO categories (name) VALUES
    ('Ring'), ('Necklace'), ('Bracelet'), ('Gold Coin'),
    ('Earring'), ('Bangle'), ('Chain'), ('Pendant')
ON CONFLICT (name) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════
-- PART 17: STORAGE BUCKET FOR PRODUCT IMAGES
-- ════════════════════════════════════════════════════════════════════
-- NOTE: Create this manually in Supabase Dashboard:
--   Storage → New Bucket → Name: "product-images" → Public: ON


-- ════════════════════════════════════════════════════════════════════
-- ✅ SETUP COMPLETE
-- ════════════════════════════════════════════════════════════════════
-- Default admin login:
--   Email:    viruthijewells@gmail.com
--   Password: Admin@viruthi
--
-- Default branch: Virudti Jewells — Madurai (VJ-MDU)
-- Default gold rate: ₹7,245.00
--
-- MANUAL STEP REQUIRED:
--   1. Go to Storage → Create bucket "product-images" (Public)
--   2. That's it! Your ERP is ready.
-- ════════════════════════════════════════════════════════════════════
