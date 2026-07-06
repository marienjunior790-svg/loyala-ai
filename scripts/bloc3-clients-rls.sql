-- BLOC 3 — RLS policies (run after Bloc 1)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;

DROP POLICY IF EXISTS clients_tenant_isolation ON clients;
DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_delete ON clients;

CREATE POLICY clients_select ON clients FOR SELECT TO authenticated USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ) AND deleted_at IS NULL
);

CREATE POLICY clients_insert ON clients FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY clients_update ON clients FOR UPDATE TO authenticated USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY clients_delete ON clients FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

NOTIFY pgrst, 'reload schema';
