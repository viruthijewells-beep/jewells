-- ═══════════════════════════════════════════════════════════════════════
-- 🔥 VIRUDTI JEWELLS — MULTI-METAL UPGRADE
-- Run this in the Supabase SQL Editor AFTER the initial setup.
-- Safe to run multiple times (idempotent).
-- ═══════════════════════════════════════════════════════════════════════

-- STEP 1: Add metal_type and purity columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS metal_type TEXT DEFAULT 'Gold';
ALTER TABLE products ADD COLUMN IF NOT EXISTS purity     TEXT DEFAULT '22K';

-- STEP 2: Migrate existing gold_type data into the new columns
UPDATE products
SET
    metal_type = CASE
        WHEN gold_type IN ('24K','22K','18K','14K') THEN 'Gold'
        WHEN gold_type = 'Silver'   THEN 'Silver'
        WHEN gold_type = 'Platinum' THEN 'Platinum'
        ELSE 'Gold'
    END,
    purity = CASE
        WHEN gold_type IN ('24K','22K','18K','14K') THEN gold_type
        WHEN gold_type = 'Silver'   THEN '925'
        WHEN gold_type = 'Platinum' THEN '950'
        ELSE '22K'
    END
WHERE metal_type = 'Gold' AND purity = '22K'; -- only migrate un-migrated rows

-- STEP 3: Create metal_rates table
CREATE TABLE IF NOT EXISTS metal_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metal_type      TEXT NOT NULL UNIQUE CHECK (metal_type IN ('Gold','Silver','Platinum')),
    rate            NUMERIC(10,2) NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by      UUID REFERENCES users(id)
);

-- STEP 4: Seed default rates
INSERT INTO metal_rates (metal_type, rate) VALUES
    ('Gold',     7245.00),
    ('Silver',   92.00),
    ('Platinum', 3200.00)
ON CONFLICT (metal_type) DO NOTHING;

-- STEP 5: Enable RLS on metal_rates
ALTER TABLE metal_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metal_rates_read"   ON metal_rates;
DROP POLICY IF EXISTS "metal_rates_update" ON metal_rates;
DROP POLICY IF EXISTS "metal_rates_insert" ON metal_rates;

CREATE POLICY "metal_rates_read"   ON metal_rates FOR SELECT USING (true);
CREATE POLICY "metal_rates_update" ON metal_rates FOR UPDATE USING (true);
CREATE POLICY "metal_rates_insert" ON metal_rates FOR INSERT WITH CHECK (true);

-- STEP 6: Grant access
GRANT SELECT, INSERT, UPDATE ON metal_rates TO anon, authenticated;

-- STEP 7: Enable Realtime for live rate updates (safe if already added)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE metal_rates;
EXCEPTION WHEN duplicate_object THEN
    -- Already added, skip
END;
$$;

-- STEP 8: Update create_product_with_stock RPC to support multi-metal
-- (Drop and recreate with new params)
DROP FUNCTION IF EXISTS create_product_with_stock(TEXT,UUID,TEXT,TEXT,NUMERIC,UUID,TEXT,INT,NUMERIC,NUMERIC,INT,UUID,TEXT,TEXT);

CREATE OR REPLACE FUNCTION create_product_with_stock(
    p_name          TEXT,
    p_category_id   UUID,
    p_metal_type    TEXT DEFAULT 'Gold',
    p_purity        TEXT DEFAULT '22K',
    p_design_code   TEXT DEFAULT '',
    p_weight        NUMERIC DEFAULT 0,
    p_branch_id     UUID DEFAULT NULL,
    p_sku           TEXT DEFAULT '',
    p_stock_count   INT DEFAULT 1,
    p_selling_price NUMERIC DEFAULT 0,
    p_purchase_price NUMERIC DEFAULT 0,
    p_min_stock_level INT DEFAULT 5,
    p_user_id       UUID DEFAULT NULL,
    p_image_url     TEXT DEFAULT NULL,
    p_branch_code   TEXT DEFAULT '200',
    -- backward compat: ignored if metal_type is provided
    p_gold_type     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_id    UUID;
    v_inventory_id  UUID;
    v_barcode       TEXT;
    v_design_code   TEXT;
    v_sku           TEXT;
    v_branch_seq    INT;
    v_product_seq   INT;
    v_resolved_metal TEXT;
    v_resolved_purity TEXT;
BEGIN
    -- Resolve metal/purity from either new params or legacy gold_type
    IF p_metal_type IS NOT NULL AND p_metal_type != 'Gold' THEN
        v_resolved_metal := p_metal_type;
        v_resolved_purity := p_purity;
    ELSIF p_gold_type IS NOT NULL THEN
        v_resolved_metal := CASE
            WHEN p_gold_type IN ('24K','22K','18K','14K') THEN 'Gold'
            WHEN p_gold_type = 'Silver'   THEN 'Silver'
            WHEN p_gold_type = 'Platinum' THEN 'Platinum'
            ELSE 'Gold'
        END;
        v_resolved_purity := CASE
            WHEN p_gold_type IN ('24K','22K','18K','14K') THEN p_gold_type
            ELSE p_purity
        END;
    ELSE
        v_resolved_metal  := COALESCE(p_metal_type, 'Gold');
        v_resolved_purity := COALESCE(p_purity, '22K');
    END IF;

    -- Auto design code
    SELECT COALESCE(MAX(CAST(SUBSTRING(design_code FROM '[0-9]+$') AS INT)), 0) + 1
    INTO v_product_seq FROM products;
    v_design_code := CASE
        WHEN p_design_code IS NOT NULL AND p_design_code != '' THEN p_design_code
        ELSE 'DC-' || LPAD(v_product_seq::TEXT, 5, '0')
    END;

    -- Auto SKU
    SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM '[0-9]+$') AS INT)), 0) + 1
    INTO v_branch_seq FROM branch_inventory;
    v_sku := CASE
        WHEN p_sku IS NOT NULL AND p_sku != '' THEN p_sku
        ELSE 'SKU-' || LPAD(v_branch_seq::TEXT, 6, '0')
    END;

    -- Barcode: VJ + branch code + metal prefix + timestamp
    v_barcode := 'VJ' || COALESCE(p_branch_code,'200') ||
                 UPPER(LEFT(v_resolved_metal,1)) ||
                 TO_CHAR(now(), 'YYMMDDHH24MISS') ||
                 LPAD((RANDOM()*9999)::INT::TEXT, 4, '0');

    -- Insert product
    INSERT INTO products (name, category_id, gold_type, metal_type, purity, design_code, weight_base, image_url)
    VALUES (p_name, p_category_id, v_resolved_purity, v_resolved_metal, v_resolved_purity, v_design_code, p_weight, p_image_url)
    RETURNING id INTO v_product_id;

    -- Insert branch inventory (only if branch provided)
    IF p_branch_id IS NOT NULL THEN
        INSERT INTO branch_inventory (product_id, branch_id, sku, barcode, stock_count, selling_price, purchase_price, min_stock_level)
        VALUES (v_product_id, p_branch_id, v_sku, v_barcode, p_stock_count, p_selling_price, p_purchase_price, p_min_stock_level)
        RETURNING id INTO v_inventory_id;

        -- Stock history
        INSERT INTO stock_history (product_id, branch_id, action, quantity, previous_count, new_count, user_id, notes)
        VALUES (v_product_id, p_branch_id, 'ADD', p_stock_count, 0, p_stock_count, p_user_id, 'Initial stock entry');

        -- Audit log
        INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details)
        VALUES ('CREATE', 'product', v_product_id, p_user_id,
            format('Created product "%s" (%s %s) with %s units', p_name, v_resolved_metal, v_resolved_purity, p_stock_count));
    END IF;

    RETURN jsonb_build_object(
        'product_id',   v_product_id,
        'inventory_id', v_inventory_id,
        'barcode',      v_barcode,
        'design_code',  v_design_code,
        'sku',          v_sku,
        'metal_type',   v_resolved_metal,
        'purity',       v_resolved_purity
    );
END;
$$;

-- STEP 9: Update stock RPC (no change needed — works with product_id)

-- STEP 10: Create metal_rate_history table for tracking all rate changes
CREATE TABLE IF NOT EXISTS metal_rate_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metal_type  TEXT NOT NULL,
    old_rate    NUMERIC(10,2),
    new_rate    NUMERIC(10,2) NOT NULL,
    changed_at  TIMESTAMPTZ DEFAULT now(),
    changed_by  UUID REFERENCES users(id)
);

-- RLS for history
ALTER TABLE metal_rate_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metal_rate_history_read" ON metal_rate_history;
CREATE POLICY "metal_rate_history_read" ON metal_rate_history FOR SELECT USING (true);
CREATE POLICY "metal_rate_history_insert" ON metal_rate_history FOR INSERT WITH CHECK (true);
GRANT SELECT, INSERT ON metal_rate_history TO anon, authenticated;

-- STEP 11: Auto-log trigger — fires on every metal_rates UPDATE
CREATE OR REPLACE FUNCTION log_metal_rate_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO metal_rate_history (metal_type, old_rate, new_rate, changed_by)
    VALUES (NEW.metal_type, OLD.rate, NEW.rate, NEW.updated_by);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_metal_rate_change ON metal_rates;
CREATE TRIGGER trg_metal_rate_change
    AFTER UPDATE ON metal_rates
    FOR EACH ROW
    WHEN (OLD.rate IS DISTINCT FROM NEW.rate)
    EXECUTE FUNCTION log_metal_rate_change();

-- ✅ DONE! Your database now supports Gold, Silver, and Platinum.
-- Every rate change is automatically logged in metal_rate_history.
SELECT metal_type, rate FROM metal_rates ORDER BY metal_type;
