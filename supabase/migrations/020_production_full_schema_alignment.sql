-- Loyala AI — Migration 020: full production schema alignment (single repair)
-- Closes all gaps between legacy/partial installs and repo code (001–019).
-- Safe to re-run (IF NOT EXISTS / idempotent policies).

-- ─── 1. organizations — tenant columns expected by domain-crm + worker ───────

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country_code CHAR(2) DEFAULT 'SN';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Dakar';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS currency CHAR(3) DEFAULT 'XOF';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vertical TEXT DEFAULT 'horeca';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'trialing';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE organizations SET country_code = 'SN' WHERE country_code IS NULL;
UPDATE organizations SET timezone = 'Africa/Dakar' WHERE timezone IS NULL;
UPDATE organizations SET currency = 'XOF' WHERE currency IS NULL;
UPDATE organizations SET vertical = 'horeca' WHERE vertical IS NULL;
UPDATE organizations SET plan = 'starter' WHERE plan IS NULL;
UPDATE organizations SET plan_status = 'trialing' WHERE plan_status IS NULL;
UPDATE organizations SET settings = '{}'::jsonb WHERE settings IS NULL;
UPDATE organizations SET created_at = now() WHERE created_at IS NULL;
UPDATE organizations SET updated_at = now() WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan, plan_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'organizations_updated_at'
  ) THEN
    CREATE TRIGGER organizations_updated_at
      BEFORE UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'set_updated_at missing — skip organizations trigger';
END $$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select ON organizations;
DROP POLICY IF EXISTS organizations_update ON organizations;
DROP POLICY IF EXISTS organizations_insert ON organizations;

CREATE POLICY organizations_select ON organizations
  FOR SELECT USING (id IN (SELECT public.user_org_ids()));

CREATE POLICY organizations_update ON organizations
  FOR UPDATE USING (id IN (SELECT public.user_org_ids()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'organizations_insert'
  ) THEN
    CREATE POLICY organizations_insert ON organizations
      FOR INSERT WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'organizations_insert policy skipped: %', SQLERRM;
END $$;

GRANT SELECT, UPDATE, INSERT ON organizations TO authenticated;
GRANT ALL ON organizations TO service_role;

-- ─── 1b. roles — Loyala IAM columns (legacy may only have id/code/name) ───

ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS level INT DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT true;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

UPDATE roles SET permissions = '{}' WHERE permissions IS NULL;
UPDATE roles SET level = 0 WHERE level IS NULL;
UPDATE roles SET is_system = true WHERE is_system IS NULL;

INSERT INTO roles (scope, code, name, permissions, level)
VALUES
  ('organization', 'org_owner',   'Owner',   ARRAY['*'], 100),
  ('organization', 'org_admin',   'Admin',   ARRAY['team:invite','org:settings'], 80),
  ('organization', 'org_manager', 'Manager', ARRAY['analytics:read'], 60),
  ('organization', 'org_staff',   'Staff',   ARRAY['inbox:read'], 40),
  ('organization', 'org_viewer',  'Viewer',  ARRAY['analytics:read'], 20)
ON CONFLICT (scope, code) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  level = EXCLUDED.level;

GRANT SELECT ON roles TO authenticated;
GRANT ALL ON roles TO service_role;

-- ─── 2. organization_members — membership columns ──────────────────────────

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS role_id UUID;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

UPDATE organization_members SET status = 'active' WHERE status IS NULL;
UPDATE organization_members SET joined_at = COALESCE(joined_at, created_at, now()) WHERE joined_at IS NULL;
UPDATE organization_members SET created_at = now() WHERE created_at IS NULL;

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
  RAISE NOTICE 'organization_members_role_id_fkey skipped: %', SQLERRM;
END $$;

-- ─── 3. reviews (012) if missing ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'google' CHECK (source IN ('google', 'manual', 'facebook')),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  author_name TEXT NOT NULL DEFAULT 'Client',
  content TEXT NOT NULL,
  review_url TEXT,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_org_created ON reviews(organization_id, created_at DESC);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reviews_select ON reviews;
DROP POLICY IF EXISTS reviews_insert ON reviews;
DROP POLICY IF EXISTS reviews_update ON reviews;
CREATE POLICY reviews_select ON reviews
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY reviews_insert ON reviews
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY reviews_update ON reviews
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));
GRANT SELECT, INSERT, UPDATE ON reviews TO authenticated;
GRANT ALL ON reviews TO service_role;

-- ─── 4. ai_request_logs — metrics columns (015) ──────────────────────────────

CREATE TABLE IF NOT EXISTS ai_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  use_case TEXT,
  provider TEXT,
  model TEXT,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  latency_ms INT DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS use_case TEXT;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS input_tokens INT DEFAULT 0;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS output_tokens INT DEFAULT 0;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS cached BOOLEAN DEFAULT false;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_request_logs' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'UPDATE ai_request_logs SET organization_id = tenant_id WHERE organization_id IS NULL AND tenant_id IS NOT NULL';
  END IF;
END $$;

UPDATE ai_request_logs SET cached = false WHERE cached IS NULL;
UPDATE ai_request_logs SET success = true WHERE success IS NULL;
UPDATE ai_request_logs SET request_id = id WHERE request_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_logs_org_created_loyala
  ON ai_request_logs(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- ─── 5. domain_events — ensure table exists ────────────────────────────────

CREATE TABLE IF NOT EXISTS domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  actor_id UUID,
  payload JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_org_type
  ON domain_events(organization_id, event_type, created_at DESC);

ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS domain_events_select ON domain_events;
DROP POLICY IF EXISTS domain_events_insert ON domain_events;
CREATE POLICY domain_events_select ON domain_events
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT public.user_org_ids())
  );
CREATE POLICY domain_events_insert ON domain_events
  FOR INSERT WITH CHECK (
    organization_id IS NULL OR organization_id IN (SELECT public.user_org_ids())
  );
GRANT SELECT, INSERT ON domain_events TO authenticated;
GRANT ALL ON domain_events TO service_role;

-- ─── 6. Tracker ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _loyala_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _loyala_migrations (name) VALUES ('020_production_full_schema_alignment.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
