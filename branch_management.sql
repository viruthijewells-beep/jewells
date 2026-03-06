-- ═══════════════════════════════════════════════════════════════════════════
-- BRANCH MANAGEMENT — Idempotent SQL
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ensure branches table exists with all required columns
CREATE TABLE IF NOT EXISTS branches (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    city        TEXT,
    address     TEXT,
    phone       TEXT,
    manager_name TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT branches_status_check CHECK (status IN ('active', 'inactive'))
);

-- Add columns that may be missing from an older schema
ALTER TABLE branches ADD COLUMN IF NOT EXISTS city         TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS address      TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone        TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active';

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_branches_name   ON branches(name);
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);

-- 3. Enable Row Level Security
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (idempotent)
DROP POLICY IF EXISTS "branches_select_all"  ON branches;
DROP POLICY IF EXISTS "branches_insert_admin" ON branches;
DROP POLICY IF EXISTS "branches_update_admin" ON branches;
DROP POLICY IF EXISTS "branches_delete_admin" ON branches;

-- All authenticated users can read branches
CREATE POLICY "branches_select_all"
ON branches FOR SELECT
TO authenticated
USING (true);

-- Only ADMIN role can create/update/delete
CREATE POLICY "branches_insert_admin"
ON branches FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        JOIN roles ON users.role_id = roles.id
        WHERE users.id = auth.uid()
          AND roles.name IN ('ADMIN', 'SUPER_ADMIN')
    )
);

CREATE POLICY "branches_update_admin"
ON branches FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        JOIN roles ON users.role_id = roles.id
        WHERE users.id = auth.uid()
          AND roles.name IN ('ADMIN', 'SUPER_ADMIN')
    )
);

CREATE POLICY "branches_delete_admin"
ON branches FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        JOIN roles ON users.role_id = roles.id
        WHERE users.id = auth.uid()
          AND roles.name IN ('ADMIN', 'SUPER_ADMIN')
    )
);

-- 5. Seed default branch if the table is empty
INSERT INTO branches (name, city, address, phone, manager_name, status)
SELECT
    'Main Branch — Madurai',
    'Madurai',
    'Nicholson School Complex, Moondrumavadi, Madurai – 625007',
    '+91 96009 96579',
    'Manager',
    'active'
WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1);

-- 6. Grant realtime (for live branch list updates)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'branches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE branches;
    END IF;
END$$;
