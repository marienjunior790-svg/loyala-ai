-- BLOC 2 — trigger sync tenant_id → organization_id
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

NOTIFY pgrst, 'reload schema';
