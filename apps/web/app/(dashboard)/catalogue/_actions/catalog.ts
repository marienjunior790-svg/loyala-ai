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
  bulkCreateCatalog,
  listCatalogCategories,
  getOrganization,
} from '@loyala/domain-crm';
import {
  createCatalogCategorySchema,
  updateCatalogCategorySchema,
  createCatalogItemSchema,
  updateCatalogItemSchema,
  generatedCatalogSchema,
  type GeneratedCatalogInput,
} from '@loyala/validation';
import { proxyToWorker } from '@/lib/worker/client';

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
function parseOptionsField(formData: FormData): unknown {
  const raw = formData.get('optionsJson');
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

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
    options: parseOptionsField(formData),
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

// ─── Génération / assistant IA ────────────────────────────────────────────────
export type CatalogAiState = {
  error?: string;
  preview?: GeneratedCatalogInput;
};

/**
 * Generates a full catalog (or an incremental set of items via the AI assistant)
 * from a natural-language brief. Returns an editable preview — nothing is
 * persisted until the user validates via `applyGeneratedCatalogAction`.
 */
export async function generateCatalogAction(input: {
  brief: string;
  establishmentType?: string;
}): Promise<CatalogAiState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const brief = input.brief?.trim();
    if (!brief) return { error: 'Décrivez ce que vous souhaitez générer.' };

    const supabase = await createClient();
    const [org, categories] = await Promise.all([
      getOrganization(supabase, ctx.organizationId),
      listCatalogCategories(supabase, ctx.organizationId),
    ]);

    const result = await proxyToWorker<unknown>('catalog/generate', {
      method: 'POST',
      organizationId: ctx.organizationId,
      body: {
        brief,
        establishmentType: input.establishmentType?.trim() || org?.name || 'Restaurant',
        currency: 'XOF',
        existingCategories: categories.map((c) => c.name),
      },
    });

    if (!result.ok) {
      return { error: result.error ?? 'Assistant IA indisponible' };
    }

    const parsed = generatedCatalogSchema.safeParse(result.data);
    if (!parsed.success) {
      return { error: "L'IA n'a pas renvoyé un catalogue exploitable. Réessayez." };
    }

    const totalItems = parsed.data.categories.reduce((n, c) => n + c.items.length, 0);
    if (totalItems === 0) {
      return { error: 'Aucun article généré. Précisez votre demande et réessayez.' };
    }

    return { preview: parsed.data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur génération IA' };
  }
}

/** Max photos accepted per image import (token/cost guard). */
const MAX_IMPORT_IMAGES = 4;
/** ~8 MB per base64 data URL guard. */
const MAX_IMAGE_DATA_URL_LEN = 8_000_000;

/** Shared runner: sends raw content (text and/or images) to the AI import route. */
async function runCatalogImport(
  organizationId: string,
  input: { rawText?: string; images?: string[]; establishmentType?: string }
): Promise<CatalogAiState> {
  const cleaned = (input.rawText ?? '').trim();
  const images = (input.images ?? []).filter(
    (img) => typeof img === 'string' && img.startsWith('data:image/')
  );
  if (cleaned.length < 10 && images.length === 0) {
    return { error: 'Contenu trop court à importer. Ajoutez le menu (texte, image, tableau ou lien).' };
  }
  if (images.some((img) => img.length > MAX_IMAGE_DATA_URL_LEN)) {
    return { error: 'Image trop volumineuse (max ~6 Mo). Réduisez la taille et réessayez.' };
  }

  const supabase = await createClient();
  const [org, categories] = await Promise.all([
    getOrganization(supabase, organizationId),
    listCatalogCategories(supabase, organizationId),
  ]);

  const result = await proxyToWorker<unknown>('catalog/import', {
    method: 'POST',
    organizationId,
    body: {
      rawText: cleaned.slice(0, 16_000),
      images: images.slice(0, MAX_IMPORT_IMAGES),
      establishmentType: input.establishmentType?.trim() || org?.name || 'Restaurant',
      currency: 'XOF',
      existingCategories: categories.map((c) => c.name),
    },
  });

  if (!result.ok) return { error: result.error ?? 'Import IA indisponible' };

  const parsed = generatedCatalogSchema.safeParse(result.data);
  if (!parsed.success) {
    return { error: "L'IA n'a pas pu structurer ce contenu. Vérifiez le format et réessayez." };
  }

  const totalItems = parsed.data.categories.reduce((n, c) => n + c.items.length, 0);
  if (totalItems === 0) {
    return { error: 'Aucun produit détecté dans le contenu importé.' };
  }

  return { preview: parsed.data };
}

/** Import from pasted menu text (or content extracted client-side from PDF/CSV/Excel). */
export async function importCatalogFromTextAction(input: {
  rawText: string;
  establishmentType?: string;
}): Promise<CatalogAiState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    return await runCatalogImport(ctx.organizationId, {
      rawText: input.rawText ?? '',
      establishmentType: input.establishmentType,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur d'import" };
  }
}

/** Import from menu photos / scans (OCR + Vision AI). */
export async function importCatalogFromImageAction(input: {
  images: string[];
  establishmentType?: string;
}): Promise<CatalogAiState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const images = Array.isArray(input.images) ? input.images : [];
    if (images.length === 0) return { error: 'Ajoutez au moins une photo du menu.' };
    return await runCatalogImport(ctx.organizationId, {
      images,
      establishmentType: input.establishmentType,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur d'import image" };
  }
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1|0\.0\.0\.0)|\.local$/i;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Import from a public menu URL (fetched server-side, HTML stripped, then AI-structured). */
export async function importCatalogFromUrlAction(input: {
  url: string;
}): Promise<CatalogAiState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const raw = (input.url ?? '').trim();

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { error: 'URL invalide' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { error: 'Seules les URL http(s) sont autorisées' };
    }
    if (PRIVATE_HOST.test(url.hostname)) {
      return { error: 'Cette adresse n\u2019est pas autorisée' };
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
        headers: { 'User-Agent': 'LoyalaAI-CatalogImporter/1.0' },
      });
    } catch {
      return { error: 'Impossible de récupérer cette page' };
    }
    if (!res.ok) return { error: `La page a répondu ${res.status}` };

    const html = (await res.text()).slice(0, 400_000);
    const text = stripHtml(html);
    if (text.length < 40) {
      return { error: 'Aucun contenu exploitable trouvé sur cette page' };
    }

    return await runCatalogImport(ctx.organizationId, { rawText: text });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur d'import URL" };
  }
}

export type CatalogApplyState = {
  error?: string;
  success?: string;
  categoriesCreated?: number;
  itemsCreated?: number;
};

/** Persists a (possibly user-edited) generated catalog. */
export async function applyGeneratedCatalogAction(
  payload: GeneratedCatalogInput
): Promise<CatalogApplyState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const parsed = generatedCatalogSchema.safeParse(payload);
    if (!parsed.success) return { error: 'Catalogue invalide' };

    const supabase = await createClient();
    const { categoriesCreated, itemsCreated } = await bulkCreateCatalog(
      supabase,
      ctx.organizationId,
      parsed.data
    );
    revalidateCatalog();
    return {
      success: `${itemsCreated} article(s) et ${categoriesCreated} catégorie(s) ajouté(s)`,
      categoriesCreated,
      itemsCreated,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur ajout du catalogue' };
  }
}
