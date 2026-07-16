-- Loyala AI — Migration 032: Catalogue & ventes (multi-secteur, multi-tenant)
--
-- Introduces a per-organization catalog (products / services / rentals) and turns
-- client visits into real sales composed of line items. Backward compatible:
-- client_visits.amount stays the authoritative total (now the sum of line items
-- when they exist). Extensible via `type` + `metadata` for future reservations,
-- rooms, subscriptions, rentals — no schema change required to add new item kinds.

-- ─── Catégories ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_org
  ON catalog_categories(organization_id, sort_order);

-- ─── Articles (produits / services / locations) ──────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES catalog_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'product'
    CHECK (type IN ('product', 'service', 'rental')),
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  tax_rate NUMERIC(5,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sku TEXT,
  photo_url TEXT,
  duration_minutes INT,
  stock INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_org_active
  ON catalog_items(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_items_org_category
  ON catalog_items(organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_org_type
  ON catalog_items(organization_id, type);

-- ─── Lignes d'achat rattachées à une visite ──────────────────────────────────
CREATE TABLE IF NOT EXISTS visit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES client_visits(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
  -- Snapshots so historical sales stay accurate even if the catalog changes.
  name TEXT NOT NULL,
  category_name TEXT,
  item_type TEXT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_items_org_visit
  ON visit_items(organization_id, visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_items_catalog_item
  ON visit_items(catalog_item_id);

-- ─── RLS (aligné sur client_visits / campaigns) ──────────────────────────────
ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['catalog_categories', 'catalog_items', 'visit_items']
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

-- ─── updated_at triggers ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS catalog_categories_updated_at ON catalog_categories;
CREATE TRIGGER catalog_categories_updated_at
  BEFORE UPDATE ON catalog_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS catalog_items_updated_at ON catalog_items;
CREATE TRIGGER catalog_items_updated_at
  BEFORE UPDATE ON catalog_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
