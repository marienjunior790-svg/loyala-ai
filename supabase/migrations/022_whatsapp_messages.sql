-- Loyala AI — Migration 022: WhatsApp API message log (Meta Cloud API)
-- Links campaign_sends → whatsapp_messages; wa.me fallback unchanged on campaign_sends.

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  campaign_send_id UUID REFERENCES campaign_sends(id) ON DELETE SET NULL,
  wamid TEXT UNIQUE,
  phone TEXT NOT NULL,
  template_name TEXT,
  message_body TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org_created
  ON whatsapp_messages(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_campaign_send
  ON whatsapp_messages(campaign_send_id)
  WHERE campaign_send_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client
  ON whatsapp_messages(client_id, created_at DESC)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
  ON whatsapp_messages(organization_id, status);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_messages_select ON whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_insert ON whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_update ON whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_delete ON whatsapp_messages;

CREATE POLICY whatsapp_messages_select ON whatsapp_messages
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

-- Inserts/updates from worker + webhooks use service_role (bypasses RLS).
CREATE POLICY whatsapp_messages_insert ON whatsapp_messages
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY whatsapp_messages_update ON whatsapp_messages
  FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY whatsapp_messages_delete ON whatsapp_messages
  FOR DELETE USING (organization_id IN (SELECT public.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_messages TO authenticated;
GRANT ALL ON whatsapp_messages TO service_role;

DROP TRIGGER IF EXISTS whatsapp_messages_updated_at ON whatsapp_messages;
CREATE TRIGGER whatsapp_messages_updated_at
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
