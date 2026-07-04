-- Align clients table with Loyala web CRM (run AFTER inspect-clients-schema.sql)
-- Loyala expects: organization_id, full_name, phone, deleted_at, etc.

-- A) Add organization_id if missing (common when table came from another schema)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID;

-- B) Backfill from common alternate column names (safe no-op if column absent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'UPDATE clients SET organization_id = tenant_id WHERE organization_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'org_id'
  ) THEN
    EXECUTE 'UPDATE clients SET organization_id = org_id WHERE organization_id IS NULL';
  END IF;
END $$;

-- C) Add other Loyala columns if missing
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'new';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS visit_count INT DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_points INT DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS opt_in_whatsapp BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- D) FK to organizations (skip if organizations.id type differs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'clients_organization_id_fkey'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK clients_organization_id_fkey skipped: %', SQLERRM;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;

NOTIFY pgrst, 'reload schema';

-- E) Verify organization_id exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients' AND column_name IN ('organization_id', 'tenant_id', 'org_id');
