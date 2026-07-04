-- Fix common /clients 503 causes (run statements one at a time)

-- 1) RLS helper required by clients policies
CREATE OR REPLACE FUNCTION auth.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

-- 2) Soft-delete column used by listClients()
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3) Reload API schema cache
NOTIFY pgrst, 'reload schema';

-- 4) Verify (service role — not auth.uid())
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'deleted_at';

SELECT proname, pronamespace::regnamespace AS schema
FROM pg_proc WHERE proname = 'user_org_ids';
