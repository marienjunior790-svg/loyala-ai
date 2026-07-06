-- BLOC 1 only — safe to run via psql or node scripts/run-sql-file.mjs
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'new';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS visit_count INT DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_points INT DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS opt_in_whatsapp BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE clients SET organization_id = tenant_id WHERE organization_id IS NULL AND tenant_id IS NOT NULL;
UPDATE clients SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

NOTIFY pgrst, 'reload schema';
