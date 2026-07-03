-- Loyala AI — Migration 005: aggregated AI metrics RPC (dashboard, indexed)

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
    AND p_organization_id NOT IN (SELECT auth.user_org_ids())
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
