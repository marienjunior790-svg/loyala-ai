-- 038: User profiles (display name) + team listing RPC
-- organization_members RLS only exposes the caller's own row (037), so the team list
-- goes through a SECURITY DEFINER RPC that checks the caller's membership first.

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT CHECK (full_name IS NULL OR char_length(full_name) <= 120),
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, INSERT ON public.profiles TO authenticated;
-- email mirrors auth.users and is maintained by triggers only
GRANT UPDATE (full_name, avatar_url, updated_at) ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- ─── Keep profiles in sync with auth.users ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile ON auth.users;
CREATE TRIGGER on_auth_user_profile
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_profile();

INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  NULLIF(trim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- ─── Team listing for members of the same organization ──────────────────────

CREATE OR REPLACE FUNCTION public.list_organization_team(p_organization_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  role_code TEXT,
  status TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.user_id, p.full_name, p.email, r.code, om.status, om.joined_at
  FROM organization_members om
  LEFT JOIN profiles p ON p.id = om.user_id
  LEFT JOIN roles r ON r.id = om.role_id
  WHERE om.organization_id = p_organization_id
    AND om.status = 'active'
    AND EXISTS (
      SELECT 1 FROM organization_members me
      WHERE me.organization_id = p_organization_id
        AND me.user_id = auth.uid()
        AND me.status = 'active'
    )
  ORDER BY om.joined_at ASC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_organization_team(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_organization_team(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
