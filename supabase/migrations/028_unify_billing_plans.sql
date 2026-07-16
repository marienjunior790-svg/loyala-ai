-- Loyala AI — Migration 028: unify billing plans (trial|growth|pro)
-- Maps legacy starter→growth, enterprise→pro; lock plan* from JWT clients

-- Drop old CHECK if present, then rematerialize
DO $$
DECLARE cname TEXT;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'organizations'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%plan%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE organizations DROP CONSTRAINT %I', cname);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE '028: plan check drop skipped: %', SQLERRM;
END $$;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'trial';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'trialing';

UPDATE organizations SET plan = 'growth' WHERE plan IN ('starter', 'Starter');
UPDATE organizations SET plan = 'pro' WHERE plan IN ('enterprise', 'Enterprise');
UPDATE organizations SET plan = 'trial' WHERE plan IS NULL OR plan NOT IN ('trial', 'growth', 'pro');
UPDATE organizations SET plan_status = 'trialing' WHERE plan_status IS NULL;

ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'trial';
ALTER TABLE organizations ALTER COLUMN plan_status SET DEFAULT 'trialing';

DO $$
BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_plan_check
    CHECK (plan IN ('trial', 'growth', 'pro'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_plan_status_check
    CHECK (plan_status IN ('trialing', 'active', 'past_due', 'cancelled', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Prevent authenticated JWT from self-upgrading plan*
CREATE OR REPLACE FUNCTION public.prevent_org_plan_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated'
     OR (current_user IN ('authenticated', 'anon')) THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.plan_status IS DISTINCT FROM OLD.plan_status THEN
      RAISE EXCEPTION 'plan and plan_status are managed by billing service only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_lock_plan ON organizations;
CREATE TRIGGER organizations_lock_plan
  BEFORE UPDATE OF plan, plan_status ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_org_plan_self_update();

CREATE TABLE IF NOT EXISTS _loyala_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _loyala_migrations (name) VALUES ('028_unify_billing_plans.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
