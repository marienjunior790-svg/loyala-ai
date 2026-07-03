-- Loyala AI — Migration 001: Platform core (IAM + tenancy)
-- Sprint 0: socle uniquement — pas de tables métier CRM

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- TENANT
-- ─────────────────────────────────────────────

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'SN',
  timezone TEXT NOT NULL DEFAULT 'Africa/Dakar',
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  vertical TEXT NOT NULL DEFAULT 'horeca',
  plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'growth', 'enterprise')),
  plan_status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (plan_status IN ('trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_plan ON organizations(plan, plan_status);

-- ─────────────────────────────────────────────
-- IAM
-- ─────────────────────────────────────────────

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('platform', 'organization')),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  level INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, code)
);

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_members_org ON organization_members(organization_id, status);
CREATE INDEX idx_members_user ON organization_members(user_id);

-- ─────────────────────────────────────────────
-- DOMAIN EVENTS (audit / event bus)
-- ─────────────────────────────────────────────

CREATE TABLE domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  actor_id UUID,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_domain_events_org_type
  ON domain_events(organization_id, event_type, created_at DESC);
CREATE INDEX idx_domain_events_aggregate
  ON domain_events(aggregate_type, aggregate_id, created_at DESC);

-- ─────────────────────────────────────────────
-- SEED: system roles (organization scope)
-- ─────────────────────────────────────────────

INSERT INTO roles (scope, code, name, permissions, level) VALUES
  ('organization', 'org_owner',   'Owner',   ARRAY['*'], 100),
  ('organization', 'org_admin',   'Admin',   ARRAY['team:invite','org:settings'], 80),
  ('organization', 'org_manager', 'Manager', ARRAY['analytics:read'], 60),
  ('organization', 'org_staff',   'Staff',   ARRAY['inbox:read'], 40),
  ('organization', 'org_viewer',  'Viewer',  ARRAY['analytics:read'], 20);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION auth.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

-- organizations
CREATE POLICY organizations_select ON organizations
  FOR SELECT USING (id IN (SELECT auth.user_org_ids()));

CREATE POLICY organizations_update ON organizations
  FOR UPDATE USING (id IN (SELECT auth.user_org_ids()));

-- organization_members
CREATE POLICY members_select ON organization_members
  FOR SELECT USING (organization_id IN (SELECT auth.user_org_ids()));

-- roles (system roles readable by all authenticated users)
CREATE POLICY roles_select ON roles
  FOR SELECT TO authenticated USING (true);

-- domain_events
CREATE POLICY domain_events_select ON domain_events
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id IN (SELECT auth.user_org_ids())
  );

CREATE POLICY domain_events_insert ON domain_events
  FOR INSERT WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT auth.user_org_ids())
  );

-- ─────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
