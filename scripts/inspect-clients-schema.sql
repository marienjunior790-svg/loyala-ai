-- Inspect real schema (run in Supabase SQL Editor — no auth.uid())

-- 1) All columns on clients
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clients'
ORDER BY ordinal_position;

-- 2) All columns on organization_members
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organization_members'
ORDER BY ordinal_position;

-- 3) Existing policies on clients
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'clients';

-- 4) Sample row structure (max 1 row, service role)
SELECT * FROM clients LIMIT 1;
