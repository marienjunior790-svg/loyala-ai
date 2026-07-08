-- Loyala AI — Migration 016: repair campaigns RLS + CRUD/scheduling fields
-- Root cause repair: 012 policies used auth.user_org_ids(); 014 repaired sibling
-- tables with public.user_org_ids() but left campaigns policies out of date.

-- ─── Ensure campaigns table exists (012 may have been skipped partially) ───

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('birthday', 'inactive', 'loyalty', 'promotion', 'manual')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'scheduled', 'paused', 'completed', 'failed')),
  message_preview TEXT,
  target_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Widen status check for existing installs still on 012 statuses only
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'campaigns'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE campaigns DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('draft', 'ready', 'scheduled', 'paused', 'completed', 'failed'));
END $$;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_campaigns_org_created ON campaigns(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_scheduled ON campaigns(organization_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'campaigns_updated_at'
  ) THEN
    CREATE TRIGGER campaigns_updated_at
      BEFORE UPDATE ON campaigns
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─── RLS on public.user_org_ids() (align with 014) ─────────────────────────

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_select ON campaigns;
DROP POLICY IF EXISTS campaigns_insert ON campaigns;
DROP POLICY IF EXISTS campaigns_update ON campaigns;
DROP POLICY IF EXISTS campaigns_delete ON campaigns;

CREATE POLICY campaigns_select ON campaigns
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY campaigns_insert ON campaigns
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY campaigns_update ON campaigns
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY campaigns_delete ON campaigns
  FOR DELETE USING (organization_id IN (SELECT public.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO authenticated;
GRANT ALL ON campaigns TO service_role;
