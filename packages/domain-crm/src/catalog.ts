import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateCatalogCategoryInput,
  UpdateCatalogCategoryInput,
  CreateCatalogItemInput,
  UpdateCatalogItemInput,
} from '@loyala/validation';

export type CatalogItemType = 'product' | 'service' | 'rental';

export interface CatalogCategory {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  id: string;
  organization_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  type: CatalogItemType;
  price: number;
  currency: string;
  tax_rate: number | null;
  is_active: boolean;
  sku: string | null;
  photo_url: string | null;
  duration_minutes: number | null;
  stock: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  catalog_categories?: { name: string } | null;
}

function assertOk(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// ─── Catégories ──────────────────────────────────────────────────────────────

export async function listCatalogCategories(
  supabase: SupabaseClient,
  organizationId: string
): Promise<CatalogCategory[]> {
  const { data, error } = await supabase
    .from('catalog_categories')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  assertOk(error);
  return (data ?? []) as CatalogCategory[];
}

export async function createCatalogCategory(
  supabase: SupabaseClient,
  organizationId: string,
  input: CreateCatalogCategoryInput
): Promise<CatalogCategory> {
  const { data, error } = await supabase
    .from('catalog_categories')
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();

  assertOk(error);
  return data as CatalogCategory;
}

export async function updateCatalogCategory(
  supabase: SupabaseClient,
  organizationId: string,
  categoryId: string,
  input: UpdateCatalogCategoryInput
): Promise<CatalogCategory> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.description !== undefined) payload.description = input.description?.trim() || null;
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  const { data, error } = await supabase
    .from('catalog_categories')
    .update(payload)
    .eq('id', categoryId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  assertOk(error);
  return data as CatalogCategory;
}

export async function deleteCatalogCategory(
  supabase: SupabaseClient,
  organizationId: string,
  categoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('catalog_categories')
    .delete()
    .eq('id', categoryId)
    .eq('organization_id', organizationId);

  assertOk(error);
}

// ─── Articles ────────────────────────────────────────────────────────────────

export interface ListCatalogItemsFilter {
  type?: CatalogItemType;
  categoryId?: string;
  activeOnly?: boolean;
  search?: string;
}

export async function listCatalogItems(
  supabase: SupabaseClient,
  organizationId: string,
  filter: ListCatalogItemsFilter = {}
): Promise<CatalogItem[]> {
  let query = supabase
    .from('catalog_items')
    .select('*, catalog_categories(name)')
    .eq('organization_id', organizationId);

  if (filter.type) query = query.eq('type', filter.type);
  if (filter.categoryId) query = query.eq('category_id', filter.categoryId);
  if (filter.activeOnly) query = query.eq('is_active', true);
  if (filter.search && filter.search.trim()) {
    const term = `%${filter.search.trim()}%`;
    query = query.or(`name.ilike.${term},sku.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await query.order('name', { ascending: true }).limit(500);

  assertOk(error);
  return (data ?? []) as CatalogItem[];
}

export async function getCatalogItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string
): Promise<CatalogItem | null> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*, catalog_categories(name)')
    .eq('id', itemId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  assertOk(error);
  return (data as CatalogItem | null) ?? null;
}

function itemInsertPayload(
  organizationId: string,
  input: CreateCatalogItemInput
): Record<string, unknown> {
  return {
    organization_id: organizationId,
    category_id: input.categoryId || null,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    type: input.type,
    price: input.price,
    currency: input.currency ?? 'XOF',
    tax_rate: input.taxRate ?? null,
    is_active: input.isActive ?? true,
    sku: input.sku?.trim() || null,
    photo_url: input.photoUrl?.trim() || null,
    duration_minutes: input.durationMinutes ?? null,
    stock: input.stock ?? null,
  };
}

export async function createCatalogItem(
  supabase: SupabaseClient,
  organizationId: string,
  input: CreateCatalogItemInput
): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from('catalog_items')
    .insert(itemInsertPayload(organizationId, input))
    .select('*, catalog_categories(name)')
    .single();

  assertOk(error);
  return data as CatalogItem;
}

export async function updateCatalogItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  input: UpdateCatalogItemInput
): Promise<CatalogItem> {
  const payload: Record<string, unknown> = {};
  if (input.categoryId !== undefined) payload.category_id = input.categoryId || null;
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.description !== undefined) payload.description = input.description?.trim() || null;
  if (input.type !== undefined) payload.type = input.type;
  if (input.price !== undefined) payload.price = input.price;
  if (input.currency !== undefined) payload.currency = input.currency;
  if (input.taxRate !== undefined) payload.tax_rate = input.taxRate ?? null;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.sku !== undefined) payload.sku = input.sku?.trim() || null;
  if (input.photoUrl !== undefined) payload.photo_url = input.photoUrl?.trim() || null;
  if (input.durationMinutes !== undefined) payload.duration_minutes = input.durationMinutes ?? null;
  if (input.stock !== undefined) payload.stock = input.stock ?? null;

  const { data, error } = await supabase
    .from('catalog_items')
    .update(payload)
    .eq('id', itemId)
    .eq('organization_id', organizationId)
    .select('*, catalog_categories(name)')
    .single();

  assertOk(error);
  return data as CatalogItem;
}

export async function setCatalogItemActive(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('catalog_items')
    .update({ is_active: isActive })
    .eq('id', itemId)
    .eq('organization_id', organizationId);

  assertOk(error);
}

export async function deleteCatalogItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from('catalog_items')
    .delete()
    .eq('id', itemId)
    .eq('organization_id', organizationId);

  assertOk(error);
}
