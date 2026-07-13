-- Loyala AI — Migration 023: WhatsApp conversation sessions (24h window, ADR-010 Phase 2)
-- Tracks last inbound/outbound per client+channel for Message Router session-open checks.

CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'sms', 'email', 'rcs', 'messenger')),
  external_address TEXT NOT NULL,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_org_client
  ON conversation_sessions(organization_id, client_id);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_external
  ON conversation_sessions(channel, external_address);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_inbound
  ON conversation_sessions(organization_id, last_inbound_at DESC)
  WHERE last_inbound_at IS NOT NULL;

ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_sessions_select ON conversation_sessions;
DROP POLICY IF EXISTS conversation_sessions_insert ON conversation_sessions;
DROP POLICY IF EXISTS conversation_sessions_update ON conversation_sessions;
DROP POLICY IF EXISTS conversation_sessions_delete ON conversation_sessions;

CREATE POLICY conversation_sessions_select ON conversation_sessions
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY conversation_sessions_insert ON conversation_sessions
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY conversation_sessions_update ON conversation_sessions
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY conversation_sessions_delete ON conversation_sessions
  FOR DELETE USING (organization_id IN (SELECT public.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_sessions TO authenticated;
GRANT ALL ON conversation_sessions TO service_role;

DROP TRIGGER IF EXISTS conversation_sessions_updated_at ON conversation_sessions;
CREATE TRIGGER conversation_sessions_updated_at
  BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
