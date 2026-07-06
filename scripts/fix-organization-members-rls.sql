-- Loyala AI — Fix infinite RLS recursion on organization_members
-- Supabase SQL Editor → coller tout → Run
-- Idempotent (safe to re-run)

-- ═══ 1. Inspect (before) — optional, comment out if editor unstable ══════════
-- SELECT policyname, cmd, qual::text, with_check::text
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'organization_members';

-- ═══ 2. Drop ALL policies on organization_members ═════════════════════════════

DROP POLICY IF EXISTS members_select ON public.organization_members;
DROP POLICY IF EXISTS members_select_own ON public.organization_members;
DROP POLICY IF EXISTS members_insert ON public.organization_members;
DROP POLICY IF EXISTS members_update ON public.organization_members;
DROP POLICY IF EXISTS members_delete ON public.organization_members;
DROP POLICY IF EXISTS organization_members_tenant_isolation ON public.organization_members;

-- ═══ 3. Recreate SAFE policies (no self-subquery, no auth.user_org_ids()) ════

CREATE POLICY members_select ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY members_insert ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY members_update ON public.organization_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ═══ 4. RPC — membership lookup for Next.js (SECURITY DEFINER, no RLS loop) ══

CREATE OR REPLACE FUNCTION public.get_my_active_membership()
RETURNS TABLE (organization_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
    AND om.status = 'active'
  ORDER BY om.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_active_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_active_membership() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ═══ 5. Verify (after) ════════════════════════════════════════════════════════

SELECT policyname, cmd, qual::text AS using_expr, with_check::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'organization_members'
ORDER BY policyname;
