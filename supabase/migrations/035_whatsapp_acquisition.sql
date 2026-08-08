-- 035: WhatsApp acquisition — client source + inbound leads + trackable sources

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS whatsapp_profile_name TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_org_acquisition
  ON clients(organization_id, acquisition_source)
  WHERE deleted_at IS NULL AND acquisition_source IS NOT NULL;

CREATE TABLE IF NOT EXISTS acquisition_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  message_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_acquisition_sources_org
  ON acquisition_sources(organization_id);

ALTER TABLE acquisition_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acquisition_sources_select ON acquisition_sources;
DROP POLICY IF EXISTS acquisition_sources_write ON acquisition_sources;

CREATE POLICY acquisition_sources_select ON acquisition_sources
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY acquisition_sources_write ON acquisition_sources
  FOR ALL USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON acquisition_sources TO authenticated;
GRANT ALL ON acquisition_sources TO service_role;

CREATE TABLE IF NOT EXISTS whatsapp_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  profile_name TEXT,
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ,
  last_wamid TEXT,
  acquisition_source TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'ignored')),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone_normalized)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_leads_org_status
  ON whatsapp_leads(organization_id, status, last_message_at DESC);

ALTER TABLE whatsapp_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_leads_select ON whatsapp_leads;
DROP POLICY IF EXISTS whatsapp_leads_write ON whatsapp_leads;

CREATE POLICY whatsapp_leads_select ON whatsapp_leads
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY whatsapp_leads_write ON whatsapp_leads
  FOR ALL USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_leads TO authenticated;
GRANT ALL ON whatsapp_leads TO service_role;
