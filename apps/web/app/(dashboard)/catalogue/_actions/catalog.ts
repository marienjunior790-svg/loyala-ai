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
  suggestVariants as suggestVariantsByRule,
  type OptionGroup,
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
import { fetchMenuUrlContent } from '@/lib/catalogue/fetch-menu-url';

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
      return {
        error:
          'Aucun article généré. Ajoutez le type de cuisine (ex. « restaurant congolais, burgers, pizzas ») ou cliquez une suggestion, puis réessayez.',
      };
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

/** Import from a public menu URL (HTML, DigiMenu QR API, or JSON — then AI-structured). */
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

    const fetched = await fetchMenuUrlContent(raw);
    if (!fetched.ok) return { error: fetched.error };

    return await runCatalogImport(ctx.organizationId, { rawText: fetched.text });
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

// ─── Suggestion de variantes (IA + repli par règles) ──────────────────────────
export type VariantSuggestInput = { name: string; category?: string; type?: string };
export type VariantSuggestState = {
  error?: string;
  /** Groupes suggérés, indexés par nom de produit. */
  suggestions?: Record<string, OptionGroup[]>;
  source?: 'ai' | 'rules';
};

/** Max produits enrichis par appel (garde-fou coût/latence). */
const MAX_SUGGEST_ITEMS = 40;

function genOptId(prefix: string): string {
  const rnd = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}`;
}

const OPTION_KINDS = new Set([
  'size',
  'portion',
  'cooking',
  'flavor',
  'temperature',
  'spice',
  'supplement',
  'removable',
  'custom',
]);

/** Maps an AI group (no ids) to a domain OptionGroup with generated ids. */
function mapAiGroup(raw: unknown): OptionGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const name = typeof g.name === 'string' ? g.name.trim() : '';
  const choicesRaw = Array.isArray(g.choices) ? g.choices : [];
  if (!name || choicesRaw.length === 0) return null;
  const kind = typeof g.kind === 'string' && OPTION_KINDS.has(g.kind) ? (g.kind as OptionGroup['kind']) : 'custom';
  const selection = g.selection === 'multiple' ? 'multiple' : 'single';
  const choices = choicesRaw
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const cc = c as Record<string, unknown>;
      const label = typeof cc.label === 'string' ? cc.label.trim() : '';
      if (!label) return null;
      return { id: genOptId('c'), label, priceDelta: Number(cc.priceDelta) || 0 };
    })
    .filter((c): c is { id: string; label: string; priceDelta: number } => c !== null)
    .slice(0, 40);
  if (choices.length === 0) return null;
  return {
    id: genOptId('g'),
    name,
    kind,
    selection,
    required: Boolean(g.required),
    choices,
  };
}

/**
 * Suggests variants/supplements for a batch of products via the AI pipeline,
 * with a deterministic rule-based fallback so the feature always returns
 * something usable. Nothing is persisted — the caller edits then applies.
 */
export async function suggestVariantsAction(
  input: { items: VariantSuggestInput[]; establishmentType?: string }
): Promise<VariantSuggestState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const items = (input.items ?? [])
      .filter((i) => i?.name?.trim())
      .slice(0, MAX_SUGGEST_ITEMS);
    if (items.length === 0) return { suggestions: {} };

    const supabase = await createClient();
    const org = await getOrganization(supabase, ctx.organizationId);

    const suggestions: Record<string, OptionGroup[]> = {};

    const result = await proxyToWorker<{ items?: { name?: string; groups?: unknown[] }[] }>(
      'catalog/variants',
      {
        method: 'POST',
        organizationId: ctx.organizationId,
        body: {
          items,
          establishmentType: input.establishmentType?.trim() || org?.name || 'Restaurant',
          currency: 'XOF',
        },
      }
    );

    if (result.ok && Array.isArray(result.data?.items)) {
      for (const it of result.data.items) {
        const name = typeof it?.name === 'string' ? it.name.trim() : '';
        if (!name) continue;
        const groups = (it.groups ?? [])
          .map(mapAiGroup)
          .filter((g): g is OptionGroup => g !== null);
        if (groups.length > 0) suggestions[name] = groups;
      }
    }

    // Rule-based fallback for any item the AI left empty (or if the AI failed).
    let usedRules = false;
    for (const item of items) {
      const key = item.name.trim();
      if (suggestions[key]?.length) continue;
      const rule = suggestVariantsByRule(key, item.category);
      if (rule.length > 0) {
        suggestions[key] = rule;
        usedRules = true;
      }
    }

    return {
      suggestions,
      source: result.ok && Object.keys(suggestions).length > 0 && !usedRules ? 'ai' : 'rules',
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur suggestion de variantes' };
  }
}
