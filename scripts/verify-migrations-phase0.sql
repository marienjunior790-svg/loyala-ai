-- Loyala AI — Phase 0 migration verification (read-only)
-- Exécuter dans Supabase SQL Editor avant go-live Phase 1.

-- ─── 008 : organization_members.status ─────────────────────────────────────
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_members'
        AND column_name = 'status'
    ) THEN 'OK'
    ELSE 'MISSING'
  END AS migration_008_status_column;

-- ─── 009/010 : RPC membership ───────────────────────────────────────────────
SELECT
  proname,
  prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'get_my_active_membership'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Attendu : 1 ligne, security_definer = true

-- ─── 010 : politiques organization_members non récursives ───────────────────
SELECT policyname, cmd, qual::text AS using_expr
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'organization_members'
ORDER BY policyname;

-- Attendu : members_select USING (user_id = auth.uid()) — pas de auth.user_org_ids()

-- ─── 002 : clients.organization_id + RLS ────────────────────────────────────
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
  AND column_name IN ('organization_id', 'tenant_id', 'segment')
ORDER BY column_name;

SELECT relrowsecurity AS clients_rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'clients';

-- ─── 011 (optionnel) : trigger sync tenant_id ───────────────────────────────
SELECT tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'clients' AND tgname = 'clients_sync_loyala_columns';

-- ─── Sanity : membres actifs visibles ───────────────────────────────────────
-- SELECT count(*) FROM organization_members WHERE status = 'active';
