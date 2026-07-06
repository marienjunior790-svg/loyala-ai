-- Loyala AI — Migration 011: align legacy Prisma clients columns (tenant_id, name)
-- Safe for shared DB with backend-api: additive only, no data deletion.
-- Skip silently on fresh Loyala installs (organization_id already present, no tenant_id).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'tenant_id'
  ) THEN
    RAISE NOTICE '011: tenant_id absent — skip legacy alignment';
    RETURN;
  END IF;

  ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name TEXT;

  UPDATE clients
  SET organization_id = tenant_id
  WHERE organization_id IS NULL AND tenant_id IS NOT NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name'
  ) THEN
    EXECUTE 'UPDATE clients SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_clients_loyala_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'tenant_id'
    ) AND NEW.tenant_id IS NOT NULL THEN
      NEW.organization_id := NEW.tenant_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name'
    ) AND NEW.name IS NOT NULL THEN
      NEW.full_name := NEW.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_sync_loyala_columns ON clients;
CREATE TRIGGER clients_sync_loyala_columns
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_clients_loyala_columns();
