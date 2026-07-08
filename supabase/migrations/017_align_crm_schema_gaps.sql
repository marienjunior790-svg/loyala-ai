-- Loyala AI — Migration 017: align CRM schema with production code
-- Root cause: a pre-existing / partial `clients` (and related) table meant
-- CREATE TABLE in 002/012 never created Loyala columns (loyalty_points,
-- opt_in_whatsapp, date_of_birth, etc.). Repair scripts existed outside
-- supabase/migrations and were never applied to production.

-- ─── Ensure public.user_org_ids() exists ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org_ids() TO service_role;

-- ─── clients: add all columns expected by @loyala/domain-crm ───────────────

ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'new';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS visit_count INT NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS opt_in_whatsapp BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Backfill from legacy Prisma columns when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'UPDATE clients SET organization_id = tenant_id WHERE organization_id IS NULL AND tenant_id IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name'
  ) THEN
    EXECUTE 'UPDATE clients SET full_name = name WHERE (full_name IS NULL OR full_name = '''') AND name IS NOT NULL';
  END IF;
END $$;

UPDATE clients SET loyalty_points = 0 WHERE loyalty_points IS NULL;
UPDATE clients SET opt_in_whatsapp = true WHERE opt_in_whatsapp IS NULL;
UPDATE clients SET visit_count = 0 WHERE visit_count IS NULL;
UPDATE clients SET total_spent = 0 WHERE total_spent IS NULL;
UPDATE clients SET segment = 'new' WHERE segment IS NULL OR segment = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND constraint_name = 'clients_organization_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE clients
        ADD CONSTRAINT clients_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'clients_organization_id_fkey skipped: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_org_created ON clients(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_org_segment ON clients(organization_id, segment);
CREATE INDEX IF NOT EXISTS idx_clients_org_phone ON clients(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_clients_org_birthday
  ON clients(organization_id, date_of_birth)
  WHERE date_of_birth IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_delete ON clients;

CREATE POLICY clients_select ON clients
  FOR SELECT USING (
    organization_id IN (SELECT public.user_org_ids())
    AND deleted_at IS NULL
  );

CREATE POLICY clients_insert ON clients
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY clients_update ON clients
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY clients_delete ON clients
  FOR DELETE USING (organization_id IN (SELECT public.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;
GRANT ALL ON clients TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'clients_updated_at') THEN
    CREATE TRIGGER clients_updated_at
      BEFORE UPDATE ON clients
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'set_updated_at missing — clients_updated_at trigger skipped';
END $$;

-- ─── campaigns: ensure Loyala CRM columns ──────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('birthday', 'inactive', 'loyalty', 'promotion', 'manual')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  message_preview TEXT,
  target_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS message_preview TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_count INT NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

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
EXCEPTION WHEN others THEN
  RAISE NOTICE 'campaigns status check skipped: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_org_created ON campaigns(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_scheduled ON campaigns(organization_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

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

-- ─── campaign_sends ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  whatsapp_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS message_body TEXT;
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS whatsapp_url TEXT;
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_campaign_sends_org_created ON campaign_sends(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_client ON campaign_sends(client_id);

ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_sends_select ON campaign_sends;
DROP POLICY IF EXISTS campaign_sends_insert ON campaign_sends;
DROP POLICY IF EXISTS campaign_sends_update ON campaign_sends;
CREATE POLICY campaign_sends_select ON campaign_sends
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY campaign_sends_insert ON campaign_sends
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY campaign_sends_update ON campaign_sends
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON campaign_sends TO authenticated;
GRANT ALL ON campaign_sends TO service_role;

-- ─── loyalty_transactions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  points_delta INT NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_org ON loyalty_transactions(organization_id, created_at DESC);
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_tx_select ON loyalty_transactions;
DROP POLICY IF EXISTS loyalty_tx_insert ON loyalty_transactions;
CREATE POLICY loyalty_tx_select ON loyalty_transactions
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY loyalty_tx_insert ON loyalty_transactions
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));
GRANT SELECT, INSERT ON loyalty_transactions TO authenticated;
GRANT ALL ON loyalty_transactions TO service_role;

-- ─── notifications ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select ON notifications;
DROP POLICY IF EXISTS notifications_update ON notifications;
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;

-- ─── Track + reload PostgREST schema cache ─────────────────────────────────

CREATE TABLE IF NOT EXISTS _loyala_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _loyala_migrations (name) VALUES ('017_align_crm_schema_gaps.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
