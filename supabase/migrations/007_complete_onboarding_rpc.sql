-- Loyala AI — Migration 007: atomic onboarding RPC
-- Creates the first organization + owner membership + audit events in one
-- SECURITY DEFINER transaction, avoiding RLS read-after-insert issues.

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_organization_name TEXT,
  p_country_code TEXT DEFAULT 'SN',
  p_timezone TEXT DEFAULT 'Africa/Dakar',
  p_currency TEXT DEFAULT 'XOF'
)
RETURNS TABLE (
  organization_id UUID,
  organization_slug TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role_id UUID;
  v_org_id UUID;
  v_slug TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Idempotency: if the user already belongs to an org, return it.
  SELECT om.organization_id, o.slug
  INTO v_org_id, v_slug
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.user_id = v_user_id
    AND om.status = 'active'
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN QUERY SELECT v_org_id, v_slug;
    RETURN;
  END IF;

  SELECT id
  INTO v_role_id
  FROM roles
  WHERE scope = 'organization'
    AND code = 'org_owner'
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'missing_org_owner_role';
  END IF;

  v_slug := regexp_replace(lower(p_organization_name), '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  v_slug := left(v_slug, 48) || '-' || substr(md5(random()::text), 1, 5);

  INSERT INTO organizations (name, slug, country_code, timezone, currency)
  VALUES (p_organization_name, v_slug, p_country_code, p_timezone, p_currency)
  RETURNING id, slug INTO v_org_id, v_slug;

  INSERT INTO organization_members (organization_id, user_id, role_id, status)
  VALUES (v_org_id, v_user_id, v_role_id, 'active');

  INSERT INTO domain_events (
    organization_id,
    event_type,
    event_version,
    aggregate_type,
    aggregate_id,
    actor_id,
    payload
  )
  VALUES
    (
      v_org_id,
      'organization.created',
      1,
      'organization',
      v_org_id,
      v_user_id,
      jsonb_build_object(
        'name', p_organization_name,
        'slug', v_slug,
        'countryCode', p_country_code
      )
    ),
    (
      v_org_id,
      'member.joined',
      1,
      'organization_member',
      v_org_id,
      v_user_id,
      jsonb_build_object('userId', v_user_id, 'role', 'org_owner')
    );

  RETURN QUERY SELECT v_org_id, v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT, TEXT, TEXT) TO authenticated;
