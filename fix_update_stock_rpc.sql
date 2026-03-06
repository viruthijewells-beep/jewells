-- Create the missing update_stock RPC function
-- Called by POS checkout (REMOVE) and Inventory +/- buttons (ADD/REMOVE)
-- Uses: branch_inventory.stock_count, stock_history(action_type, old_count, new_count, reason, user_id)

CREATE OR REPLACE FUNCTION public.update_stock(
    p_product_id UUID,
    p_branch_id  UUID,
    p_amount     INTEGER,
    p_action     TEXT,       -- 'ADD' or 'REMOVE'
    p_reason     TEXT DEFAULT '',
    p_user_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inventory_id UUID;
    v_old_count    INTEGER;
    v_new_count    INTEGER;
BEGIN
    -- 1. Lock the inventory row for atomic update
    SELECT id, stock_count
    INTO v_inventory_id, v_old_count
    FROM branch_inventory
    WHERE product_id = p_product_id AND branch_id = p_branch_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found in branch inventory';
    END IF;

    -- 2. Calculate new count
    IF p_action = 'REMOVE' THEN
        v_new_count := v_old_count - p_amount;
        IF v_new_count < 0 THEN
            RAISE EXCEPTION 'Insufficient stock: have %, need %', v_old_count, p_amount;
        END IF;
    ELSIF p_action = 'ADD' THEN
        v_new_count := v_old_count + p_amount;
    ELSE
        RAISE EXCEPTION 'Invalid action: %. Must be ADD or REMOVE', p_action;
    END IF;

    -- 3. Update inventory
    UPDATE branch_inventory
    SET stock_count = v_new_count, updated_at = NOW()
    WHERE id = v_inventory_id;

    -- 4. Log to stock history (using correct column names)
    INSERT INTO stock_history (product_id, branch_id, old_count, new_count, action_type, reason, user_id)
    VALUES (p_product_id, p_branch_id, v_old_count, v_new_count, p_action, p_reason, p_user_id);

    -- 5. Return result
    RETURN jsonb_build_object(
        'inventory_id', v_inventory_id,
        'old_count', v_old_count,
        'new_count', v_new_count
    );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.update_stock TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
