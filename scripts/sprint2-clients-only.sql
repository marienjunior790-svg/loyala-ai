-- Loyala AI — Sprint 2 bootstrap (run ONE statement at a time in Supabase SQL Editor)
-- Use when the web editor freezes on multi-statement scripts.

-- 0) Prerequisite helper (required by clients RLS)
CREATE OR REPLACE FUNCTION auth.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

-- 1) Table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  segment TEXT NOT NULL DEFAULT 'new'
    CHECK (segment IN ('new', 'regular', 'vip', 'inactive', 'at_risk')),
  visit_count INT NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  loyalty_points INT NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  opt_in_whatsapp BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, phone)
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_clients_org_created ON clients(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_org_segment ON clients(organization_id, segment);
CREATE INDEX IF NOT EXISTS idx_clients_org_phone ON clients(organization_id, phone);

-- 3) RLS + grants
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;

-- 4) Policies (run each separately if needed)
DROP POLICY IF EXISTS clients_select ON clients;
CREATE POLICY clients_select ON clients FOR SELECT USING (
  organization_id IN (SELECT auth.user_org_ids()) AND deleted_at IS NULL
);

DROP POLICY IF EXISTS clients_insert ON clients;
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (
  organization_id IN (SELECT auth.user_org_ids())
);

DROP POLICY IF EXISTS clients_update ON clients;
CREATE POLICY clients_update ON clients FOR UPDATE USING (
  organization_id IN (SELECT auth.user_org_ids())
);

DROP POLICY IF EXISTS clients_delete ON clients;
CREATE POLICY clients_delete ON clients FOR DELETE USING (
  organization_id IN (SELECT auth.user_org_ids())
);

-- 5) Trigger (requires set_updated_at from migration 001)
DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6) Optional birthday column (migration 004)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 7) Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
