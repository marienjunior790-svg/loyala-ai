-- Loyala AI — Migration 006: Go-Live onboarding grants
-- Ensures authenticated users can read system roles and create their first org.

GRANT SELECT ON roles TO authenticated;
GRANT SELECT, INSERT ON organizations TO authenticated;
GRANT SELECT, INSERT ON organization_members TO authenticated;
GRANT SELECT, INSERT ON domain_events TO authenticated;

-- Idempotent safety: seed system roles if the initial migration was partially applied.
INSERT INTO roles (scope, code, name, permissions, level)
VALUES
  ('organization', 'org_owner',   'Owner',   ARRAY['*'], 100),
  ('organization', 'org_admin',   'Admin',   ARRAY['team:invite','org:settings'], 80),
  ('organization', 'org_manager', 'Manager', ARRAY['analytics:read'], 60),
  ('organization', 'org_staff',   'Staff',   ARRAY['inbox:read'], 40),
  ('organization', 'org_viewer',  'Viewer',  ARRAY['analytics:read'], 20)
ON CONFLICT (scope, code) DO NOTHING;

-- Policies are idempotently recreated for environments where migration 002 was not applied.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND policyname = 'organizations_insert'
  ) THEN
    CREATE POLICY organizations_insert ON organizations
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_members'
      AND policyname = 'members_insert'
  ) THEN
    CREATE POLICY members_insert ON organization_members
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
