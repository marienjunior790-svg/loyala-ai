-- Loyala AI — Migration 027: fix Admin members join + campaigns.tenant_id legacy
-- Fixes:
--  1) PostgREST: relationship organization_members → roles
--  2) campaigns.tenant_id NOT NULL when app only sends organization_id

-- ─── 1. Ensure role_id FK for PostgREST embeds ─────────────────────────────

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS role_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND constraint_name = 'organization_members_role_id_fkey'
  ) THEN
    -- Clear orphan role_ids before FK
    UPDATE organization_members om
    SET role_id = NULL
    WHERE role_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM roles r WHERE r.id = om.role_id);

    ALTER TABLE organization_members
      ADD CONSTRAINT organization_members_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES roles(id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE '027: FK organization_members.role_id skipped: %', SQLERRM;
END $$;

-- Backfill missing roles (first active member → owner, others → staff)
DO $$
DECLARE v_owner_id UUID;
DECLARE v_staff_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM roles WHERE scope = 'organization' AND code = 'org_owner' LIMIT 1;
  SELECT id INTO v_staff_id FROM roles WHERE scope = 'organization' AND code = 'org_staff' LIMIT 1;
  IF v_owner_id IS NULL THEN RETURN; END IF;

  WITH ranked AS (
    SELECT om.id,
      ROW_NUMBER() OVER (
        PARTITION BY om.organization_id
        ORDER BY COALESCE(om.joined_at, om.created_at) ASC, om.id ASC
      ) AS rn
    FROM organization_members om
    WHERE om.status = 'active' AND om.role_id IS NULL
  )
  UPDATE organization_members om SET role_id = v_owner_id
  FROM ranked r WHERE om.id = r.id AND r.rn = 1;

  IF v_staff_id IS NOT NULL THEN
    UPDATE organization_members
    SET role_id = v_staff_id
    WHERE status = 'active' AND role_id IS NULL;
  END IF;
END $$;

GRANT SELECT ON roles TO authenticated;
GRANT SELECT ON roles TO service_role;

-- ─── 2. Align legacy campaigns.tenant_id (if present) ───────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'UPDATE campaigns SET tenant_id = organization_id WHERE tenant_id IS NULL AND organization_id IS NOT NULL';
    EXECUTE 'UPDATE campaigns SET organization_id = tenant_id WHERE organization_id IS NULL AND tenant_id IS NOT NULL';

    -- Sync trigger: keep both columns aligned on write
    CREATE OR REPLACE FUNCTION public.sync_campaigns_tenant_org()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      IF NEW.organization_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
        NEW.organization_id := NEW.tenant_id;
      END IF;
      IF NEW.tenant_id IS NULL AND NEW.organization_id IS NOT NULL THEN
        NEW.tenant_id := NEW.organization_id;
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS campaigns_sync_tenant_org ON campaigns;
    CREATE TRIGGER campaigns_sync_tenant_org
      BEFORE INSERT OR UPDATE OF organization_id, tenant_id ON campaigns
      FOR EACH ROW EXECUTE FUNCTION public.sync_campaigns_tenant_org();
  END IF;
END $$;

-- Same for campaign_sends if legacy tenant_id exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaign_sends' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'UPDATE campaign_sends SET tenant_id = organization_id WHERE tenant_id IS NULL AND organization_id IS NOT NULL';
    EXECUTE 'UPDATE campaign_sends SET organization_id = tenant_id WHERE organization_id IS NULL AND tenant_id IS NOT NULL';

    CREATE OR REPLACE FUNCTION public.sync_campaign_sends_tenant_org()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      IF NEW.organization_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
        NEW.organization_id := NEW.tenant_id;
      END IF;
      IF NEW.tenant_id IS NULL AND NEW.organization_id IS NOT NULL THEN
        NEW.tenant_id := NEW.organization_id;
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS campaign_sends_sync_tenant_org ON campaign_sends;
    CREATE TRIGGER campaign_sends_sync_tenant_org
      BEFORE INSERT OR UPDATE OF organization_id, tenant_id ON campaign_sends
      FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_sends_tenant_org();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS _loyala_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _loyala_migrations (name) VALUES ('027_fix_members_roles_and_campaigns_tenant.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
