-- Hotfix production: organisations.plan_status (+ colonnes tenant critiques)
-- Coller dans Supabase Dashboard → SQL Editor → Run
-- Idempotent (IF NOT EXISTS). Corrige: campagnes + paramètres.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country_code CHAR(2) DEFAULT 'SN';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Dakar';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS currency CHAR(3) DEFAULT 'XOF';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'trialing';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE organizations SET country_code = 'SN' WHERE country_code IS NULL;
UPDATE organizations SET timezone = 'Africa/Dakar' WHERE timezone IS NULL;
UPDATE organizations SET currency = 'XOF' WHERE currency IS NULL;
UPDATE organizations SET plan = 'starter' WHERE plan IS NULL;
UPDATE organizations SET plan_status = 'trialing' WHERE plan_status IS NULL;
UPDATE organizations SET settings = '{}'::jsonb WHERE settings IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan, plan_status);
