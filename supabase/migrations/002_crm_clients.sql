-- Loyala AI — Migration 002: CRM clients (Sprint 1)

CREATE TABLE clients (
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

CREATE INDEX idx_clients_org_created ON clients(organization_id, created_at DESC);
CREATE INDEX idx_clients_org_segment ON clients(organization_id, segment);
CREATE INDEX idx_clients_org_phone ON clients(organization_id, phone);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select ON clients
  FOR SELECT USING (
    organization_id IN (SELECT auth.user_org_ids())
    AND deleted_at IS NULL
  );

CREATE POLICY clients_insert ON clients
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT auth.user_org_ids())
  );

CREATE POLICY clients_update ON clients
  FOR UPDATE USING (
    organization_id IN (SELECT auth.user_org_ids())
  );

CREATE POLICY clients_delete ON clients
  FOR DELETE USING (
    organization_id IN (SELECT auth.user_org_ids())
  );

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Allow authenticated users to insert their first organization (onboarding)
CREATE POLICY organizations_insert ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY members_insert ON organization_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
