-- Loyala AI — Migration 033: Variantes intelligentes (rétrocompatible)
--
-- Sprint 4 stores configurable variants, supplements, option groups and their
-- availability inside catalog_items.metadata (JSONB) — no rigid columns, so the
-- model stays extensible for combos, promotions, online orders, POS, stock and
-- multilingual translation without further migrations.
--
-- This migration is 100% backward compatible:
--   • metadata already exists with a '{}' default (migration 032) — nothing to
--     backfill; items without options simply have no metadata.options key.
--   • adds a GIN index so option/variant lookups stay fast at 10k+ products.

-- Ensure the column exists and defaults to an empty object (idempotent safety).
ALTER TABLE catalog_items
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE catalog_items SET metadata = '{}'::jsonb WHERE metadata IS NULL;

ALTER TABLE catalog_items
  ALTER COLUMN metadata SET NOT NULL;

-- GIN index for containment / key lookups on metadata (variants, availability…).
CREATE INDEX IF NOT EXISTS idx_catalog_items_metadata_gin
  ON catalog_items USING gin (metadata jsonb_path_ops);

COMMENT ON COLUMN catalog_items.metadata IS
  'Extensible JSONB: { options: OptionGroup[] } for variants/supplements/option groups (Sprint 4), plus future combos/promos/i18n.';
