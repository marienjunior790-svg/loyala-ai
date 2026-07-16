'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  createCatalogCategory,
  updateCatalogCategory,
  deleteCatalogCategory,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  setCatalogItemActive,
} from '@loyala/domain-crm';
import {
  createCatalogCategorySchema,
  updateCatalogCategorySchema,
  createCatalogItemSchema,
  updateCatalogItemSchema,
} from '@loyala/validation';

export type CatalogActionState = { error?: string; success?: string };

const WRITE = 'clients:write' as const;

function revalidateCatalog() {
  revalidatePath('/catalogue');
}

// ─── Catégories ──────────────────────────────────────────────────────────────
export async function createCategoryAction(
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const parsed = createCatalogCategorySchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      sortOrder: formData.get('sortOrder') || undefined,
    });
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };

    const supabase = await createClient();
    await createCatalogCategory(supabase, ctx.organizationId, parsed.data);
    revalidateCatalog();
    return { success: 'Catégorie créée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur création catégorie' };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const parsed = updateCatalogCategorySchema.safeParse({
      name: formData.get('name') || undefined,
      description: formData.get('description') ?? undefined,
      sortOrder: formData.get('sortOrder') || undefined,
    });
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };

    const supabase = await createClient();
    await updateCatalogCategory(supabase, ctx.organizationId, categoryId, parsed.data);
    revalidateCatalog();
    return { success: 'Catégorie mise à jour' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur modification catégorie' };
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<CatalogActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    await deleteCatalogCategory(supabase, ctx.organizationId, categoryId);
    revalidateCatalog();
    return { success: 'Catégorie supprimée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur suppression catégorie' };
  }
}

// ─── Articles ────────────────────────────────────────────────────────────────
function parseItemForm(formData: FormData) {
  return {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    categoryId: formData.get('categoryId') || undefined,
    type: formData.get('type') || undefined,
    price: formData.get('price'),
    currency: formData.get('currency') || undefined,
    taxRate: formData.get('taxRate') || undefined,
    isActive: formData.get('isActive') !== 'false',
    sku: formData.get('sku') || undefined,
    photoUrl: formData.get('photoUrl') || undefined,
    durationMinutes: formData.get('durationMinutes') || undefined,
    stock: formData.get('stock') || undefined,
  };
}

export async function createItemAction(
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const parsed = createCatalogItemSchema.safeParse(parseItemForm(formData));
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };

    const supabase = await createClient();
    await createCatalogItem(supabase, ctx.organizationId, parsed.data);
    revalidateCatalog();
    return { success: 'Article créé' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur création article' };
  }
}

export async function updateItemAction(
  itemId: string,
  _prev: CatalogActionState,
  formData: FormData
): Promise<CatalogActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const parsed = updateCatalogItemSchema.safeParse(parseItemForm(formData));
    if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };

    const supabase = await createClient();
    await updateCatalogItem(supabase, ctx.organizationId, itemId, parsed.data);
    revalidateCatalog();
    return { success: 'Article mis à jour' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur modification article' };
  }
}

export async function toggleItemActiveAction(
  itemId: string,
  isActive: boolean
): Promise<CatalogActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    await setCatalogItemActive(supabase, ctx.organizationId, itemId, isActive);
    revalidateCatalog();
    return { success: isActive ? 'Article activé' : 'Article désactivé' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur statut article' };
  }
}

export async function deleteItemAction(itemId: string): Promise<CatalogActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    await deleteCatalogItem(supabase, ctx.organizationId, itemId);
    revalidateCatalog();
    return { success: 'Article supprimé' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur suppression article' };
  }
}
