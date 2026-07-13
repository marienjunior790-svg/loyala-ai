-- Loyala AI — Migration 024: Meta WhatsApp template catalog (ADR-010 Phase 3)
-- Platform templates (organization_id NULL). Worker uses status = 'approved' only.

CREATE TABLE IF NOT EXISTS message_template_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'sms', 'email', 'rcs', 'messenger')),
  intent TEXT NOT NULL
    CHECK (intent IN ('birthday', 'inactive', 'loyalty', 'promo', 'transactional', 'reply')),
  provider_template_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'fr',
  body_pattern TEXT NOT NULL,
  variable_count INT NOT NULL DEFAULT 0 CHECK (variable_count >= 0),
  variable_specs JSONB NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'marketing'
    CHECK (category IN ('marketing', 'utility')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_template_platform_name
  ON message_template_catalog (provider_template_name)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_template_org_intent
  ON message_template_catalog (organization_id, channel, intent, language)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_template_catalog_intent
  ON message_template_catalog(channel, intent, status);

CREATE INDEX IF NOT EXISTS idx_message_template_catalog_org
  ON message_template_catalog(organization_id)
  WHERE organization_id IS NOT NULL;

ALTER TABLE message_template_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_template_catalog_select ON message_template_catalog;
DROP POLICY IF EXISTS message_template_catalog_insert ON message_template_catalog;
DROP POLICY IF EXISTS message_template_catalog_update ON message_template_catalog;
DROP POLICY IF EXISTS message_template_catalog_delete ON message_template_catalog;

CREATE POLICY message_template_catalog_select ON message_template_catalog
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY message_template_catalog_insert ON message_template_catalog
  FOR INSERT WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY message_template_catalog_update ON message_template_catalog
  FOR UPDATE USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY message_template_catalog_delete ON message_template_catalog
  FOR DELETE USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_org_ids())
  );

GRANT SELECT ON message_template_catalog TO authenticated;
GRANT ALL ON message_template_catalog TO service_role;

DROP TRIGGER IF EXISTS message_template_catalog_updated_at ON message_template_catalog;
CREATE TRIGGER message_template_catalog_updated_at
  BEFORE UPDATE ON message_template_catalog
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Platform seed (pending Meta approval — worker falls back to code catalog until approved)
INSERT INTO message_template_catalog (
  organization_id, channel, intent, provider_template_name, language,
  body_pattern, variable_count, variable_specs, category, status
)
SELECT NULL, 'whatsapp', 'birthday', 'loyala_birthday_v1', 'fr',
  'Bonjour {{1}}, {{2}} 🎉 — {{3}}', 3,
  '[{"slot":1,"maxLength":60,"role":"first_name"},{"slot":2,"maxLength":200,"role":"body_core"},{"slot":3,"maxLength":60,"role":"restaurant_name"}]'::jsonb,
  'marketing', 'pending_approval'
WHERE NOT EXISTS (
  SELECT 1 FROM message_template_catalog
  WHERE organization_id IS NULL AND provider_template_name = 'loyala_birthday_v1'
);

INSERT INTO message_template_catalog (
  organization_id, channel, intent, provider_template_name, language,
  body_pattern, variable_count, variable_specs, category, status
)
SELECT NULL, 'whatsapp', 'inactive', 'loyala_inactive_v1', 'fr',
  'Bonjour {{1}}. {{2}} À bientôt chez {{3}}', 3,
  '[{"slot":1,"maxLength":60,"role":"first_name"},{"slot":2,"maxLength":200,"role":"body_core"},{"slot":3,"maxLength":60,"role":"restaurant_name"}]'::jsonb,
  'marketing', 'pending_approval'
WHERE NOT EXISTS (
  SELECT 1 FROM message_template_catalog
  WHERE organization_id IS NULL AND provider_template_name = 'loyala_inactive_v1'
);

INSERT INTO message_template_catalog (
  organization_id, channel, intent, provider_template_name, language,
  body_pattern, variable_count, variable_specs, category, status
)
SELECT NULL, 'whatsapp', 'loyalty', 'loyala_loyalty_v1', 'fr',
  'Bonjour {{1}}, {{2}} — {{3}}', 3,
  '[{"slot":1,"maxLength":60,"role":"first_name"},{"slot":2,"maxLength":200,"role":"body_core"},{"slot":3,"maxLength":60,"role":"restaurant_name"}]'::jsonb,
  'marketing', 'pending_approval'
WHERE NOT EXISTS (
  SELECT 1 FROM message_template_catalog
  WHERE organization_id IS NULL AND provider_template_name = 'loyala_loyalty_v1'
);

INSERT INTO message_template_catalog (
  organization_id, channel, intent, provider_template_name, language,
  body_pattern, variable_count, variable_specs, category, status
)
SELECT NULL, 'whatsapp', 'promo', 'loyala_promo_v1', 'fr',
  '{{1}} : {{2}}. {{3}}', 3,
  '[{"slot":1,"maxLength":60,"role":"restaurant_name"},{"slot":2,"maxLength":200,"role":"body_core"},{"slot":3,"maxLength":60,"role":"offer"}]'::jsonb,
  'marketing', 'pending_approval'
WHERE NOT EXISTS (
  SELECT 1 FROM message_template_catalog
  WHERE organization_id IS NULL AND provider_template_name = 'loyala_promo_v1'
);
