-- Loyala AI — Migration 019: GO LIVE roles (seed + backfill + RPC)
-- Run in SQL Editor if users still show org_viewer after 017.

-- ─── 1. Seed system roles (idempotent) ─────────────────────────────────────

INSERT INTO roles (scope, code, name, permissions, level)
VALUES
  ('organization', 'org_owner',   'Owner',   ARRAY['*'], 100),
  ('organization', 'org_admin',   'Admin',   ARRAY['team:invite','org:settings'], 80),
  ('organization', 'org_manager', 'Manager', ARRAY['analytics:read'], 60),
  ('organization', 'org_staff',   'Staff',   ARRAY['inbox:read'], 40),
  ('organization', 'org_viewer',  'Viewer',  ARRAY['analytics:read'], 20)
ON CONFLICT (scope, code) DO NOTHING;

GRANT SELECT ON roles TO authenticated;
GRANT SELECT ON roles TO service_role;

-- ─── 2. Ensure role_id column + FK (PostgREST join) ────────────────────────

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS role_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND constraint_name = 'organization_members_role_id_fkey'
  ) THEN
    ALTER TABLE organization_members
      ADD CONSTRAINT organization_members_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES roles(id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK skipped: %', SQLERRM;
END $$;

-- ─── 3. Backfill: first member per org → org_owner ─────────────────────────

DO $$
DECLARE v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM roles WHERE scope = 'organization' AND code = 'org_owner' LIMIT 1;
  IF v_owner_id IS NULL THEN RETURN; END IF;

  WITH ranked AS (
    SELECT om.id,
      ROW_NUMBER() OVER (
        PARTITION BY om.organization_id
        ORDER BY COALESCE(om.joined_at, om.created_at) ASC, om.id ASC
      ) AS rn
    FROM organization_members om
    WHERE om.status = 'active' AND (om.role_id IS NULL)
  )
  UPDATE organization_members om SET role_id = v_owner_id
  FROM ranked r WHERE om.id = r.id AND r.rn = 1;

  UPDATE organization_members
  SET role_id = (SELECT id FROM roles WHERE scope = 'organization' AND code = 'org_staff' LIMIT 1)
  WHERE status = 'active' AND role_id IS NULL;
END $$;

-- ─── 4. RPC membership + role ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_active_membership()
RETURNS TABLE (organization_id UUID, role_code TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT om.organization_id, COALESCE(r.code, 'org_owner')
  FROM organization_members om
  LEFT JOIN roles r ON r.id = om.role_id
  WHERE om.user_id = auth.uid() AND om.status = 'active'
  ORDER BY COALESCE(om.created_at, om.joined_at) ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_active_membership() TO authenticated;

INSERT INTO _loyala_migrations (name) VALUES ('019_production_go_live_roles.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
