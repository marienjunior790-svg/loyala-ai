-- Loyala Web CRM — align Prisma clients schema (tenant_id, name) with Loyala (organization_id, full_name)
-- Run ONE block at a time in Supabase SQL Editor.
-- Safe for shared DB with backend-api: adds columns, does not rename Prisma columns.

-- ─── 1. Add Loyala columns on clients ───────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'new';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS visit_count INT DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_points INT DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS opt_in_whatsapp BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── 2. Backfill from Prisma column names ───────────────────────────────────
UPDATE clients SET organization_id = tenant_id WHERE organization_id IS NULL AND tenant_id IS NOT NULL;
UPDATE clients SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

-- Soft-delete: map common Prisma names if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'deleted_at'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'deletedAt'
  ) THEN
    EXECUTE 'UPDATE clients SET deleted_at = "deletedAt" WHERE deleted_at IS NULL';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'deletedAt backfill skipped';
END $$;

-- ─── 3. Keep organization_id in sync when backend-api writes tenant_id ───────
CREATE OR REPLACE FUNCTION public.sync_clients_loyala_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    NEW.organization_id := NEW.tenant_id;
  END IF;
  IF NEW.name IS NOT NULL THEN
    NEW.full_name := NEW.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_sync_loyala_columns ON clients;
CREATE TRIGGER clients_sync_loyala_columns
  BEFORE INSERT OR UPDATE OF tenant_id, name ON clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_clients_loyala_columns();

-- ─── 4. Grants + RLS policies (inline, no auth schema) ───────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;

DROP POLICY IF EXISTS clients_tenant_isolation ON clients;
DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_delete ON clients;

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

-- ─── 5. Verify ───────────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients'
  AND column_name IN ('tenant_id', 'organization_id', 'name', 'full_name', 'phone', 'deleted_at')
ORDER BY column_name;

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clients';
