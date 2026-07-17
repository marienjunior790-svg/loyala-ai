-- Loyala AI — Migration 034: Catalogue publication, versions & settings
--
-- Sprint 5 adds a production-ready publication workflow and version history
-- without changing catalog_items / catalog_categories row shapes.
-- Snapshots are JSONB (full catalog payload) for restore + audit.
-- Extensible for online orders, QR menus, POS, stock, loyalty later.

-- ─── Paramètres catalogue (1 ligne / organisation) ───────────────────────────
CREATE TABLE IF NOT EXISTS catalog_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  publication_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'in_review', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  published_version_id UUID,
  default_locale TEXT NOT NULL DEFAULT 'fr',
  locales TEXT[] NOT NULL DEFAULT ARRAY['fr']::TEXT[],
  public_slug TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_settings_public_slug
  ON catalog_settings (public_slug)
  WHERE public_slug IS NOT NULL;

-- ─── Versions / historique ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_catalog_versions_org_created
  ON catalog_versions (organization_id, created_at DESC);

-- FK soft: published_version_id → catalog_versions (added after both exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_settings_published_version_fkey'
  ) THEN
    ALTER TABLE catalog_settings
      ADD CONSTRAINT catalog_settings_published_version_fkey
      FOREIGN KEY (published_version_id) REFERENCES catalog_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE catalog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_versions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['catalog_settings', 'catalog_versions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON %I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY %I_select ON %I FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_org_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_update ON %I FOR UPDATE USING (organization_id IN (SELECT public.user_org_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_delete ON %I FOR DELETE USING (organization_id IN (SELECT public.user_org_ids()))',
      tbl, tbl
    );

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON %I TO service_role', tbl);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS catalog_settings_updated_at ON catalog_settings;
CREATE TRIGGER catalog_settings_updated_at
  BEFORE UPDATE ON catalog_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE catalog_settings IS
  'Per-tenant catalog publication state (draft/in_review/published/archived) + locales. Ready for public QR / online orders.';
COMMENT ON TABLE catalog_versions IS
  'Immutable catalog snapshots for audit, preview-before-publish and restore.';
