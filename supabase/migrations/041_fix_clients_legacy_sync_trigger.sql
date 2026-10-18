-- Loyala AI — Migration 041 : déclencheur de compatibilité Prisma (011) sur base neuve.
--
-- Le déclencheur 011 lit NEW.tenant_id et NEW.name. Sur une installation neuve,
-- ces colonnes héritées n'existent pas : toute création ou modification de client
-- échoue (« record "new" has no field "tenant_id" »).
-- La lecture passe par to_jsonb(NEW) : même comportement qu'avant quand les
-- colonnes existent (production partagée avec l'ancien backend), aucun effet sinon.
-- Aucune donnée n'est modifiée par cette migration.

CREATE OR REPLACE FUNCTION public.sync_clients_loyala_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  row_json JSONB := to_jsonb(NEW);
BEGIN
  IF row_json ? 'tenant_id' AND row_json->>'tenant_id' IS NOT NULL THEN
    NEW.organization_id := (row_json->>'tenant_id')::UUID;
  END IF;
  IF row_json ? 'name' AND row_json->>'name' IS NOT NULL THEN
    NEW.full_name := row_json->>'name';
  END IF;
  RETURN NEW;
END;
$$;
