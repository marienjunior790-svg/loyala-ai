-- Loyala AI — Fix clients RLS without auth schema (permission denied on auth.*)
-- Run ONE statement at a time in Supabase SQL Editor.

-- 0) Optional helper in public (SECURITY DEFINER) — if you prefer a function
CREATE OR REPLACE FUNCTION public.user_org_ids_active()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.user_org_ids_active() TO authenticated;

-- 1) Remove policies that reference auth.user_org_ids() or ALL catch-alls
DROP POLICY IF EXISTS clients_tenant_isolation ON clients;
DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_delete ON clients;

-- 2) Inline membership check — no auth schema required
CREATE POLICY clients_select ON clients
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
    AND deleted_at IS NULL
  );

CREATE POLICY clients_insert ON clients
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

CREATE POLICY clients_update ON clients
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

CREATE POLICY clients_delete ON clients
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

NOTIFY pgrst, 'reload schema';

-- 3) Verify
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clients' ORDER BY policyname;
