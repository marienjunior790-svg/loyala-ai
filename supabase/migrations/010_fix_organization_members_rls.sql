-- Loyala AI — Migration 010: Fix infinite RLS recursion on organization_members
--
-- Root cause: members_select used auth.user_org_ids() which reads organization_members
--             → triggers the same policy → infinite recursion.
--
-- Fix: organization_members policies use ONLY user_id = auth.uid() (no self-subquery).
--      Multi-org lookup for middleware/session via SECURITY DEFINER RPC (not a policy).

-- ─── 1. Drop ALL existing policies on organization_members ───────────────────

DROP POLICY IF EXISTS members_select ON public.organization_members;
DROP POLICY IF EXISTS members_select_own ON public.organization_members;
DROP POLICY IF EXISTS members_insert ON public.organization_members;
DROP POLICY IF EXISTS members_update ON public.organization_members;
DROP POLICY IF EXISTS members_delete ON public.organization_members;
DROP POLICY IF EXISTS organization_members_tenant_isolation ON public.organization_members;

-- ─── 2. Safe non-recursive policies ──────────────────────────────────────────

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

-- ─── 3. RPC for Next.js middleware + getAuthContext (bypasses RLS safely) ─────

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
