-- Loyala AI — Migration 015: align ai_request_logs + fix metrics RPC (Prisma coexistence)

-- ─── Add Loyala 003 columns if missing (additive, no data loss) ─────────────

ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS use_case TEXT;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS input_tokens INT;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS output_tokens INT;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS cached BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE ai_request_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

UPDATE ai_request_logs
SET organization_id = tenant_id
WHERE organization_id IS NULL AND tenant_id IS NOT NULL;

UPDATE ai_request_logs
SET input_tokens = COALESCE(input_tokens, prompt_tokens, 0)
WHERE input_tokens IS NULL;

UPDATE ai_request_logs
SET output_tokens = COALESCE(output_tokens, completion_tokens, 0)
WHERE output_tokens IS NULL;

UPDATE ai_request_logs
SET use_case = COALESCE(use_case, endpoint, 'unknown')
WHERE use_case IS NULL;

UPDATE ai_request_logs
SET success = CASE
  WHEN success IS NOT NULL THEN success
  WHEN status IN ('ok', 'success', 'completed') THEN true
  WHEN status IN ('error', 'failed') THEN false
  ELSE true
END
WHERE success IS NULL;

UPDATE ai_request_logs
SET request_id = COALESCE(request_id, id)
WHERE request_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_logs_org_created_loyala
  ON ai_request_logs(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- ─── Metrics RPC compatible with Loyala + legacy Prisma columns ─────────────

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
    'inputTokens', COALESCE(SUM(COALESCE(input_tokens, prompt_tokens, 0)), 0)::int,
    'outputTokens', COALESCE(SUM(COALESCE(output_tokens, completion_tokens, 0)), 0)::int,
    'totalTokens', COALESCE(SUM(COALESCE(input_tokens, prompt_tokens, 0) + COALESCE(output_tokens, completion_tokens, 0)), 0)::int,
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
        WHERE (organization_id = p_organization_id OR tenant_id = p_organization_id)
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
        SELECT COALESCE(use_case, endpoint, 'unknown') AS use_case,
          COUNT(*)::int AS req_count,
          COALESCE(SUM(cost_usd), 0)::float AS cost_sum
        FROM ai_request_logs
        WHERE (organization_id = p_organization_id OR tenant_id = p_organization_id)
          AND created_at >= p_since
        GROUP BY COALESCE(use_case, endpoint, 'unknown')
      ) u),
      '{}'::jsonb
    ),
    'since', p_since
  )
  INTO result
  FROM ai_request_logs
  WHERE (organization_id = p_organization_id OR tenant_id = p_organization_id)
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

-- ─── Storage bucket org-assets (retry) ───────────────────────────────────────

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
