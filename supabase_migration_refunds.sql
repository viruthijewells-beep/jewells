-- ═══════════════════════════════════════════════════════════════
-- Virudti Jewells ERP — Refund + Return + Cancel System Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- 1. Add status column to sales table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'status'
    ) THEN
        ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'COMPLETED' NOT NULL;
    END IF;
END $$;

-- 2. Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    refund_method TEXT NOT NULL DEFAULT 'CASH',
    reason TEXT,
    processed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create returns table
CREATE TABLE IF NOT EXISTS returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    sale_item_id UUID REFERENCES sale_items(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    return_reason TEXT,
    processed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS on new tables
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies — allow authenticated users full access
CREATE POLICY "refunds_all" ON refunds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "returns_all" ON returns FOR ALL USING (true) WITH CHECK (true);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_refunds_sale_id ON refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

-- Done! ✅
SELECT 'Migration complete — status column + refunds + returns tables created' AS result;
