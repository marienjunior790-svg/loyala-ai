-- 036: Per-organization WhatsApp Business connections (multi-tenant)
-- Organization → WhatsAppConnection → WhatsAppBusinessAccount → WhatsAppPhoneNumber

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (status IN (
      'not_connected',
      'connecting',
      'connected',
      'error',
      'token_expired',
      'disconnected'
    )),
  access_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  connected_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_org_status
  ON whatsapp_connections(organization_id, status);

CREATE TABLE IF NOT EXISTS whatsapp_business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  waba_id TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id),
  UNIQUE (waba_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_business_accounts_org
  ON whatsapp_business_accounts(organization_id);

CREATE TABLE IF NOT EXISTS whatsapp_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  display_phone_number TEXT NOT NULL,
  verified_name TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone_number_id),
  UNIQUE (connection_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_numbers_org
  ON whatsapp_phone_numbers(organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_numbers_phone_number_id
  ON whatsapp_phone_numbers(phone_number_id);

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_phone_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_connections_select ON whatsapp_connections;
DROP POLICY IF EXISTS whatsapp_connections_write ON whatsapp_connections;
CREATE POLICY whatsapp_connections_select ON whatsapp_connections
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );
CREATE POLICY whatsapp_connections_write ON whatsapp_connections
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS whatsapp_business_accounts_select ON whatsapp_business_accounts;
DROP POLICY IF EXISTS whatsapp_business_accounts_write ON whatsapp_business_accounts;
CREATE POLICY whatsapp_business_accounts_select ON whatsapp_business_accounts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );
CREATE POLICY whatsapp_business_accounts_write ON whatsapp_business_accounts
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS whatsapp_phone_numbers_select ON whatsapp_phone_numbers;
DROP POLICY IF EXISTS whatsapp_phone_numbers_write ON whatsapp_phone_numbers;
CREATE POLICY whatsapp_phone_numbers_select ON whatsapp_phone_numbers
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );
CREATE POLICY whatsapp_phone_numbers_write ON whatsapp_phone_numbers
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_business_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_phone_numbers TO authenticated;
GRANT ALL ON whatsapp_connections TO service_role;
GRANT ALL ON whatsapp_business_accounts TO service_role;
GRANT ALL ON whatsapp_phone_numbers TO service_role;

-- Backfill display numbers from legacy org settings (no tokens — status stays not_connected until token set)
INSERT INTO whatsapp_connections (organization_id, status, last_synced_at)
SELECT o.id, 'not_connected', now()
FROM organizations o
WHERE COALESCE(NULLIF(trim(o.settings->>'whatsapp_phone_number_id'), ''), NULLIF(trim(o.settings->>'whatsapp_phone'), '')) IS NOT NULL
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO whatsapp_phone_numbers (
  connection_id,
  organization_id,
  phone_number_id,
  display_phone_number,
  is_primary
)
SELECT
  c.id,
  c.organization_id,
  COALESCE(
    NULLIF(trim(o.settings->>'whatsapp_phone_number_id'), ''),
    'pending:' || c.organization_id::text
  ),
  COALESCE(NULLIF(trim(o.settings->>'whatsapp_phone'), ''), 'non renseigné'),
  true
FROM whatsapp_connections c
JOIN organizations o ON o.id = c.organization_id
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_phone_numbers p WHERE p.connection_id = c.id
)
AND (
  NULLIF(trim(o.settings->>'whatsapp_phone_number_id'), '') IS NOT NULL
  OR NULLIF(trim(o.settings->>'whatsapp_phone'), '') IS NOT NULL
);
