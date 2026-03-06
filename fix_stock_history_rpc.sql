-- Fix create_product_with_stock RPC: stock_history column names
-- The table has: old_count, new_count, action_type, reason
-- The RPC was using: action, quantity, previous_count, new_count, notes

DROP FUNCTION IF EXISTS create_product_with_stock(TEXT,UUID,TEXT,TEXT,TEXT,NUMERIC,UUID,TEXT,INT,NUMERIC,NUMERIC,INT,UUID,TEXT,TEXT,TEXT);

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

        -- Stock history (FIXED: use correct column names)
        INSERT INTO stock_history (product_id, branch_id, old_count, new_count, action_type, reason, user_id)
        VALUES (v_product_id, p_branch_id, 0, p_stock_count, 'ADD', 'Initial stock entry', p_user_id);

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

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
