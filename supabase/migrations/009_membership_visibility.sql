-- Loyala AI — Migration 009: membership visibility for middleware + session
-- Fixes redirect loop: user has a row in organization_members but RLS hides it
-- from the anon/authenticated client used by Next.js middleware.

-- 1. Direct policy — users can always read their own membership rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_members'
      AND policyname = 'members_select_own'
  ) THEN
    CREATE POLICY members_select_own ON organization_members
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 2. SECURITY DEFINER RPC — reliable membership lookup (bypasses RLS edge cases)
CREATE OR REPLACE FUNCTION public.get_my_active_membership()
RETURNS TABLE (organization_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.status = 'active'
  ORDER BY om.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_active_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_active_membership() TO authenticated;

NOTIFY pgrst, 'reload schema';
