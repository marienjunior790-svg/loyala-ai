-- Loyala AI — Migration 021: client visit & spend history
-- Aggregates remain on clients.visit_count, clients.total_spent, clients.last_visit_at

CREATE TABLE IF NOT EXISTS client_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'visit'
    CHECK (kind IN ('visit', 'expense')),
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(12,2),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_visits_org_client
  ON client_visits(organization_id, client_id, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_visits_client_visited
  ON client_visits(client_id, visited_at DESC);

ALTER TABLE client_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_visits_select ON client_visits;
DROP POLICY IF EXISTS client_visits_insert ON client_visits;
DROP POLICY IF EXISTS client_visits_update ON client_visits;
DROP POLICY IF EXISTS client_visits_delete ON client_visits;

CREATE POLICY client_visits_select ON client_visits
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY client_visits_insert ON client_visits
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY client_visits_update ON client_visits
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY client_visits_delete ON client_visits
  FOR DELETE USING (organization_id IN (SELECT public.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON client_visits TO authenticated;
GRANT ALL ON client_visits TO service_role;

DROP TRIGGER IF EXISTS client_visits_updated_at ON client_visits;
CREATE TRIGGER client_visits_updated_at
  BEFORE UPDATE ON client_visits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
