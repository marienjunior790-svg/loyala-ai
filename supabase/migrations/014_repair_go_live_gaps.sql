-- Loyala AI — Migration 014: repair go-live gaps (idempotent)
-- Fixes: missing RPC 005, partial 012 tables, storage 013, RLS recursion 010

-- ─── Align organization_members columns (Prisma ↔ Loyala 001) ────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'joined_at'
  ) THEN
    ALTER TABLE organization_members ADD COLUMN joined_at TIMESTAMPTZ DEFAULT now();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE organization_members ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- ─── Ensure public.user_org_ids() exists (required by RLS policies) ─────────

CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org_ids() TO service_role;

-- ─── 010: Fix organization_members RLS recursion ─────────────────────────────

DROP POLICY IF EXISTS members_select ON public.organization_members;
DROP POLICY IF EXISTS members_select_own ON public.organization_members;
DROP POLICY IF EXISTS members_insert ON public.organization_members;
DROP POLICY IF EXISTS members_update ON public.organization_members;
DROP POLICY IF EXISTS members_delete ON public.organization_members;
DROP POLICY IF EXISTS organization_members_tenant_isolation ON public.organization_members;

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
  ORDER BY COALESCE(om.created_at, om.joined_at) ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_active_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_active_membership() TO authenticated;

-- ─── 012 (partial): missing platform tables ────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'sms', 'email')),
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  whatsapp_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_org_created ON campaign_sends(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_client ON campaign_sends(client_id);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  points_delta INT NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_org ON loyalty_transactions(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'google' CHECK (source IN ('google', 'manual', 'facebook')),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  author_name TEXT NOT NULL DEFAULT 'Client',
  content TEXT NOT NULL,
  review_url TEXT,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_org ON reviews(organization_id, reviewed_at DESC);

ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_sends_select ON campaign_sends;
DROP POLICY IF EXISTS campaign_sends_insert ON campaign_sends;
DROP POLICY IF EXISTS campaign_sends_update ON campaign_sends;
DROP POLICY IF EXISTS loyalty_tx_select ON loyalty_transactions;
DROP POLICY IF EXISTS loyalty_tx_insert ON loyalty_transactions;
DROP POLICY IF EXISTS reviews_select ON reviews;
DROP POLICY IF EXISTS reviews_insert ON reviews;
DROP POLICY IF EXISTS reviews_update ON reviews;
DROP POLICY IF EXISTS reviews_delete ON reviews;

CREATE POLICY campaign_sends_select ON campaign_sends
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY campaign_sends_insert ON campaign_sends
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY campaign_sends_update ON campaign_sends
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY loyalty_tx_select ON loyalty_transactions
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY loyalty_tx_insert ON loyalty_transactions
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY reviews_select ON reviews
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY reviews_insert ON reviews
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY reviews_update ON reviews
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY reviews_delete ON reviews
  FOR DELETE USING (organization_id IN (SELECT public.user_org_ids()));

-- ─── 005: AI metrics RPC ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_tenant_ai_metrics(
  p_organization_id UUID,
  p_since TIMESTAMPTZ DEFAULT (now() - interval '30 days')
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF auth.uid() IS NOT NULL
    AND p_organization_id NOT IN (SELECT public.user_org_ids())
  THEN
    RAISE EXCEPTION 'forbidden: organization access denied';
  END IF;

  SELECT jsonb_build_object(
    'tenantId', p_organization_id,
    'requests', COALESCE(COUNT(*)::int, 0),
    'inputTokens', COALESCE(SUM(input_tokens), 0)::int,
    'outputTokens', COALESCE(SUM(output_tokens), 0)::int,
    'totalTokens', COALESCE(SUM(input_tokens + output_tokens), 0)::int,
    'costUsd', COALESCE(SUM(cost_usd), 0)::float,
    'avgLatencyMs', COALESCE(ROUND(AVG(latency_ms)), 0)::int,
    'cacheHitRate', CASE WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE cached))::float / COUNT(*)::float
      ELSE 0 END,
    'successRate', CASE WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE success))::float / COUNT(*)::float
      ELSE 1 END,
    'errorRate', CASE WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE NOT success))::float / COUNT(*)::float
      ELSE 0 END,
    'fallbackRate', CASE WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE provider = 'anthropic'))::float / COUNT(*)::float
      ELSE 0 END,
    'byProvider', COALESCE(
      (SELECT jsonb_object_agg(provider, jsonb_build_object(
        'requests', req_count,
        'costUsd', cost_sum
      ))
      FROM (
        SELECT provider,
          COUNT(*)::int AS req_count,
          COALESCE(SUM(cost_usd), 0)::float AS cost_sum
        FROM ai_request_logs
        WHERE organization_id = p_organization_id
          AND created_at >= p_since
        GROUP BY provider
      ) p),
      '{}'::jsonb
    ),
    'byUseCase', COALESCE(
      (SELECT jsonb_object_agg(use_case, jsonb_build_object(
        'requests', req_count,
        'costUsd', cost_sum
      ))
      FROM (
        SELECT use_case,
          COUNT(*)::int AS req_count,
          COALESCE(SUM(cost_usd), 0)::float AS cost_sum
        FROM ai_request_logs
        WHERE organization_id = p_organization_id
          AND created_at >= p_since
        GROUP BY use_case
      ) u),
      '{}'::jsonb
    ),
    'since', p_since
  )
  INTO result
  FROM ai_request_logs
  WHERE organization_id = p_organization_id
    AND created_at >= p_since;

  IF result IS NULL THEN
    result := jsonb_build_object(
      'tenantId', p_organization_id,
      'requests', 0,
      'inputTokens', 0,
      'outputTokens', 0,
      'totalTokens', 0,
      'costUsd', 0,
      'avgLatencyMs', 0,
      'cacheHitRate', 0,
      'successRate', 1,
      'errorRate', 0,
      'fallbackRate', 0,
      'byProvider', '{}'::jsonb,
      'byUseCase', '{}'::jsonb,
      'since', p_since
    );
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION get_tenant_ai_metrics(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tenant_ai_metrics(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ai_metrics(UUID, TIMESTAMPTZ) TO service_role;

-- ─── 013: Storage bucket org-assets ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS org_assets_read ON storage.objects;
DROP POLICY IF EXISTS org_assets_write ON storage.objects;

CREATE POLICY org_assets_read ON storage.objects
  FOR SELECT USING (bucket_id = 'org-assets');

CREATE POLICY org_assets_write ON storage.objects
  FOR ALL USING (
    bucket_id = 'org-assets'
    AND auth.role() = 'authenticated'
  );

NOTIFY pgrst, 'reload schema';
