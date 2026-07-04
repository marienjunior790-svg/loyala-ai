-- Loyala AI — Vérifications Go-Live (exécuter dans Supabase SQL Editor)
-- Phase 1 : base de données

-- ─── 1. Migrations Prisma (backend-api Railway) ───────────────────────────
SELECT migration_name, finished_at, applied_steps_count
FROM _prisma_migrations
ORDER BY finished_at;

-- Attendu : 10 lignes avec finished_at renseigné

-- ─── 2. Migrations SQL Loyala (si aussi appliquées) ───────────────────────
SELECT name, applied_at
FROM _loyala_migrations
ORDER BY applied_at;

-- ─── 3. Tables attendues ──────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Minimum Loyala web : organizations, organization_members, roles, clients,
-- domain_events, ai_request_logs

-- ─── 4. RLS actif sur tables métier ───────────────────────────────────────
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'organizations', 'organization_members', 'roles', 'clients',
    'domain_events', 'ai_request_logs'
  )
ORDER BY c.relname;

-- Attendu : rls_enabled = true pour toutes

-- ─── 5. Politiques RLS (compte) ───────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ─── 5b. Grants nécessaires onboarding ────────────────────────────────────
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'authenticated'
  AND table_name IN ('roles', 'organizations', 'organization_members', 'domain_events')
ORDER BY table_name, privilege_type;

-- ─── 6. Audit — derniers événements ───────────────────────────────────────
SELECT event_type, organization_id, created_at
FROM domain_events
ORDER BY created_at DESC
LIMIT 10;

-- ─── 7. Utilisateur test (après signup manuel) ────────────────────────────
-- SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
