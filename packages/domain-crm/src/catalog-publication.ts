import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogCategory, CatalogItem } from './catalog';
import { listCatalogCategories, listCatalogItems } from './catalog';

export type CatalogPublicationStatus = 'draft' | 'in_review' | 'published' | 'archived';

export interface CatalogSettings {
  organization_id: string;
  publication_status: CatalogPublicationStatus;
  published_at: string | null;
  published_version_id: string | null;
  default_locale: string;
  locales: string[];
  public_slug: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CatalogVersion {
  id: string;
  organization_id: string;
  version_number: number;
  label: string | null;
  status: CatalogPublicationStatus;
  snapshot: CatalogSnapshot;
  summary: string | null;
  created_by: string | null;
  created_at: string;
}

/** Future-ready snapshot shape (orders / QR / POS / stock / loyalty). */
export interface CatalogSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  currency: string;
  locale: string;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
  }>;
  items: Array<{
    id: string;
    category_id: string | null;
    name: string;
    description: string | null;
    type: string;
    price: number;
    currency: string;
    tax_rate: number | null;
    is_active: boolean;
    sku: string | null;
    photo_url: string | null;
    duration_minutes: number | null;
    stock: number | null;
    metadata: Record<string, unknown>;
  }>;
  /** Reserved for future combos / promos / loyalty hooks */
  extensions?: Record<string, unknown>;
}

function assertOk(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const DEFAULT_SETTINGS: Omit<CatalogSettings, 'organization_id' | 'created_at' | 'updated_at'> = {
  publication_status: 'draft',
  published_at: null,
  published_version_id: null,
  default_locale: 'fr',
  locales: ['fr'],
  public_slug: null,
  metadata: {},
};

export function buildCatalogSnapshot(
  categories: CatalogCategory[],
  items: CatalogItem[],
  locale = 'fr'
): CatalogSnapshot {
  const currency = items[0]?.currency ?? 'XOF';
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    currency,
    locale,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sort_order: c.sort_order,
      is_active: c.is_active,
    })),
    items: items.map((i) => ({
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      description: i.description,
      type: i.type,
      price: Number(i.price),
      currency: i.currency,
      tax_rate: i.tax_rate,
      is_active: i.is_active,
      sku: i.sku,
      photo_url: i.photo_url,
      duration_minutes: i.duration_minutes,
      stock: i.stock,
      metadata: i.metadata ?? {},
    })),
    extensions: {},
  };
}

export async function getCatalogSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<CatalogSettings> {
  const { data, error } = await supabase
    .from('catalog_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  assertOk(error);
  if (data) return data as CatalogSettings;

  const { data: created, error: insertErr } = await supabase
    .from('catalog_settings')
    .insert({ organization_id: organizationId, ...DEFAULT_SETTINGS })
    .select('*')
    .single();
  assertOk(insertErr);
  return created as CatalogSettings;
}

export async function updateCatalogPublicationStatus(
  supabase: SupabaseClient,
  organizationId: string,
  status: CatalogPublicationStatus,
  opts?: { publishedVersionId?: string | null }
): Promise<CatalogSettings> {
  await getCatalogSettings(supabase, organizationId);
  const payload: Record<string, unknown> = { publication_status: status };
  if (status === 'published') {
    payload.published_at = new Date().toISOString();
    if (opts?.publishedVersionId !== undefined) {
      payload.published_version_id = opts.publishedVersionId;
    }
  }
  if (status === 'archived' || status === 'draft') {
    // keep published_at for audit; only clear on explicit draft reset if needed
  }
  const { data, error } = await supabase
    .from('catalog_settings')
    .update(payload)
    .eq('organization_id', organizationId)
    .select('*')
    .single();
  assertOk(error);
  return data as CatalogSettings;
}

export async function listCatalogVersions(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 30
): Promise<CatalogVersion[]> {
  const { data, error } = await supabase
    .from('catalog_versions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('version_number', { ascending: false })
    .limit(limit);
  assertOk(error);
  return (data ?? []) as CatalogVersion[];
}

export async function getCatalogVersion(
  supabase: SupabaseClient,
  organizationId: string,
  versionId: string
): Promise<CatalogVersion | null> {
  const { data, error } = await supabase
    .from('catalog_versions')
    .select('*')
    .eq('id', versionId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  assertOk(error);
  return (data as CatalogVersion | null) ?? null;
}

export async function createCatalogVersion(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    label?: string;
    status?: CatalogPublicationStatus;
    summary?: string;
    createdBy?: string | null;
    categories?: CatalogCategory[];
    items?: CatalogItem[];
    locale?: string;
  } = {}
): Promise<CatalogVersion> {
  const [categories, items, latest] = await Promise.all([
    input.categories
      ? Promise.resolve(input.categories)
      : listCatalogCategories(supabase, organizationId),
    input.items ? Promise.resolve(input.items) : listCatalogItems(supabase, organizationId),
    supabase
      .from('catalog_versions')
      .select('version_number')
      .eq('organization_id', organizationId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  assertOk(latest.error);

  const next = (latest.data?.version_number ?? 0) + 1;
  const snapshot = buildCatalogSnapshot(categories, items, input.locale ?? 'fr');
  const { data, error } = await supabase
    .from('catalog_versions')
    .insert({
      organization_id: organizationId,
      version_number: next,
      label: input.label?.trim() || `v${next}`,
      status: input.status ?? 'draft',
      snapshot,
      summary:
        input.summary?.trim() ||
        `${categories.length} catégorie(s) · ${items.length} article(s)`,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single();
  assertOk(error);
  return data as CatalogVersion;
}

/**
 * Publish workflow: snapshot current catalog → mark published → update settings.
 */
export async function publishCatalog(
  supabase: SupabaseClient,
  organizationId: string,
  opts?: { label?: string; createdBy?: string | null }
): Promise<{ settings: CatalogSettings; version: CatalogVersion }> {
  const version = await createCatalogVersion(supabase, organizationId, {
    label: opts?.label ?? 'Publication',
    status: 'published',
    summary: 'Catalogue publié',
    createdBy: opts?.createdBy,
  });
  const settings = await updateCatalogPublicationStatus(supabase, organizationId, 'published', {
    publishedVersionId: version.id,
  });
  return { settings, version };
}

/**
 * Restore a previous snapshot into live catalog tables (best-effort overwrite by id).
 * Creates a new version labelled "Restauration" afterwards for audit trail.
 */
export async function restoreCatalogVersion(
  supabase: SupabaseClient,
  organizationId: string,
  versionId: string,
  createdBy?: string | null
): Promise<CatalogVersion> {
  const version = await getCatalogVersion(supabase, organizationId, versionId);
  if (!version) throw new Error('Version introuvable');
  const snap = version.snapshot;
  if (!snap?.items || !snap?.categories) throw new Error('Snapshot invalide');

  // Update existing items that still exist (safe restore — never delete live sales history)
  for (const item of snap.items) {
    const { error } = await supabase
      .from('catalog_items')
      .update({
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency,
        tax_rate: item.tax_rate,
        is_active: item.is_active,
        sku: item.sku,
        photo_url: item.photo_url,
        duration_minutes: item.duration_minutes,
        stock: item.stock,
        metadata: item.metadata ?? {},
        category_id: item.category_id,
        type: item.type,
      })
      .eq('id', item.id)
      .eq('organization_id', organizationId);
    if (error && !/0 rows/i.test(error.message)) {
      // ignore missing rows (deleted since snapshot)
    }
  }

  for (const cat of snap.categories) {
    await supabase
      .from('catalog_categories')
      .update({
        name: cat.name,
        description: cat.description,
        sort_order: cat.sort_order,
        is_active: cat.is_active,
      })
      .eq('id', cat.id)
      .eq('organization_id', organizationId);
  }

  return createCatalogVersion(supabase, organizationId, {
    label: `Restauration v${version.version_number}`,
    status: 'draft',
    summary: `Restauré depuis v${version.version_number}`,
    createdBy,
  });
}
