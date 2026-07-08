-- Loyala AI — Migration 018: repair member roles (org_viewer bug)
-- Root cause: legacy organization_members rows with NULL role_id → app defaults to org_viewer.

-- ─── Ensure role_id column exists (legacy Prisma installs) ─────────────────

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS role_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND constraint_name = 'organization_members_role_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE organization_members
        ADD CONSTRAINT organization_members_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES roles(id);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'organization_members_role_id_fkey skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- ─── Backfill: first active member per org → org_owner ─────────────────────

DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id
  FROM roles
  WHERE scope = 'organization' AND code = 'org_owner'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE '018: org_owner role missing — skip backfill';
    RETURN;
  END IF;

  WITH ranked AS (
    SELECT
      om.id,
      ROW_NUMBER() OVER (
        PARTITION BY om.organization_id
        ORDER BY COALESCE(om.joined_at, om.created_at) ASC, om.id ASC
      ) AS rn
    FROM organization_members om
    WHERE om.status = 'active' AND om.role_id IS NULL
  )
  UPDATE organization_members om
  SET role_id = v_owner_id
  FROM ranked r
  WHERE om.id = r.id AND r.rn = 1;

  -- Remaining NULL → org_staff (not viewer)
  UPDATE organization_members
  SET role_id = (SELECT id FROM roles WHERE scope = 'organization' AND code = 'org_staff' LIMIT 1)
  WHERE status = 'active' AND role_id IS NULL;
END $$;

-- ─── RPC: membership + role in one SECURITY DEFINER call ───────────────────

CREATE OR REPLACE FUNCTION public.get_my_active_membership()
RETURNS TABLE (organization_id UUID, role_code TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    om.organization_id,
    COALESCE(r.code, 'org_owner') AS role_code
  FROM public.organization_members om
  LEFT JOIN public.roles r ON r.id = om.role_id
  WHERE om.user_id = auth.uid()
    AND om.status = 'active'
  ORDER BY COALESCE(om.created_at, om.joined_at) ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_active_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_active_membership() TO authenticated;

INSERT INTO _loyala_migrations (name) VALUES ('018_repair_member_roles.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
