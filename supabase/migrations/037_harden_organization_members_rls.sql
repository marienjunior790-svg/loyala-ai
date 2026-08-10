-- 037: Harden organization_members RLS (BUG-003)
-- Prevents self-join to arbitrary orgs and self-escalation of role_id / organization_id.
-- Membership creation remains via SECURITY DEFINER RPCs (e.g. complete_onboarding).
-- SELECT stays non-recursive: own rows only (user_id = auth.uid()).

-- ─── Drop legacy / permissive policies ───────────────────────────────────────

DROP POLICY IF EXISTS members_select ON public.organization_members;
DROP POLICY IF EXISTS members_select_own ON public.organization_members;
DROP POLICY IF EXISTS members_insert ON public.organization_members;
DROP POLICY IF EXISTS members_update ON public.organization_members;
DROP POLICY IF EXISTS members_delete ON public.organization_members;
DROP POLICY IF EXISTS organization_members_tenant_isolation ON public.organization_members;

-- ─── SELECT: own membership only (no subquery on organization_members → no recursion) ─

CREATE POLICY members_select ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── INSERT: deny for authenticated (use complete_onboarding / service_role) ─

CREATE POLICY members_insert ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ─── UPDATE: deny for authenticated (blocks role_id / organization_id escalation) ─

CREATE POLICY members_update ON public.organization_members
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

-- ─── DELETE: deny for authenticated ──────────────────────────────────────────

CREATE POLICY members_delete ON public.organization_members
  FOR DELETE TO authenticated
  USING (false);

-- ─── Grants: authenticated may SELECT own rows; no direct INSERT/UPDATE/DELETE ─

REVOKE INSERT, UPDATE, DELETE ON public.organization_members FROM authenticated;
GRANT SELECT ON public.organization_members TO authenticated;

-- service_role keeps full access (Supabase bypasses RLS for service_role by default)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO service_role;

-- Ensure onboarding RPC still callable (SECURITY DEFINER inserts membership)
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
