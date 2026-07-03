-- Loyala AI — Migration 003: AI request logs (token monitoring)
-- Blueprint §5 — all IA calls logged for cost control

CREATE TABLE ai_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  use_case TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_logs_org_created ON ai_request_logs(organization_id, created_at DESC);
CREATE INDEX idx_ai_logs_use_case ON ai_request_logs(use_case, created_at DESC);

ALTER TABLE ai_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_logs_select ON ai_request_logs
  FOR SELECT USING (organization_id IN (SELECT auth.user_org_ids()));

-- Inserts via service role (worker) only — no member insert policy
