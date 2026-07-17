'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  listCatalogCategories,
  listCatalogItems,
  updateCatalogCategory,
  updateCatalogItem,
  getItemOptions,
  mergeItemMetadata,
  getOrganization,
  getCatalogSettings,
} from '@loyala/domain-crm';
import { proxyToWorker } from '@/lib/worker/client';

export type TranslateCatalogState = {
  error?: string;
  success?: string;
  locale?: string;
  translatedItems?: number;
};

const LOCALES = new Set(['fr', 'en', 'ar', 'es', 'pt']);

/**
 * Translates catalog names/descriptions/option labels via AI, stores under
 * metadata.translations[locale], and optionally applies as live content when
 * replaceLive=true (keeps prices/structure).
 */
export async function translateCatalogAction(input: {
  locale: string;
  replaceLive?: boolean;
}): Promise<TranslateCatalogState> {
  try {
    const ctx = await requireAuthPermission('clients:write');
    const locale = (input.locale || 'en').trim().toLowerCase().slice(0, 8);
    if (!LOCALES.has(locale)) {
      return { error: 'Langue non supportée (fr, en, ar, es, pt).' };
    }

    const supabase = await createClient();
    const [org, categories, items] = await Promise.all([
      getOrganization(supabase, ctx.organizationId),
      listCatalogCategories(supabase, ctx.organizationId),
      listCatalogItems(supabase, ctx.organizationId),
    ]);

    if (items.length === 0 && categories.length === 0) {
      return { error: 'Catalogue vide — rien à traduire.' };
    }

    const catalogPayload = {
      categories: categories.slice(0, 40).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? '',
      })),
      items: items.slice(0, 60).map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description ?? '',
        options: getItemOptions(i).map((g) => ({
          id: g.id,
          name: g.name,
          choices: g.choices.map((c) => ({ id: c.id, label: c.label })),
        })),
      })),
    };

    const result = await proxyToWorker<{
      locale?: string;
      categories?: { id: string; name: string; description?: string }[];
      items?: {
        id: string;
        name: string;
        description?: string;
        options?: { id: string; name: string; choices: { id: string; label: string }[] }[];
      }[];
    }>('catalog/translate', {
      method: 'POST',
      organizationId: ctx.organizationId,
      body: {
        locale,
        establishmentType: org?.name || 'Restaurant',
        catalog: catalogPayload,
      },
    });

    if (!result.ok) return { error: result.error ?? 'Traduction IA indisponible' };

    const translatedCats = new Map(
      (result.data?.categories ?? []).map((c) => [c.id, c] as const)
    );
    const translatedItems = new Map((result.data?.items ?? []).map((i) => [i.id, i] as const));

    let updated = 0;

    for (const cat of categories) {
      const t = translatedCats.get(cat.id);
      if (!t) continue;
      if (input.replaceLive) {
        await updateCatalogCategory(supabase, ctx.organizationId, cat.id, {
          name: t.name,
          description: t.description ?? '',
        });
      }
    }

    for (const item of items) {
      const t = translatedItems.get(item.id);
      if (!t) continue;

      const existingTranslations =
        ((item.metadata?.translations as Record<string, unknown> | undefined) ?? {}) as Record<
          string,
          unknown
        >;
      const groups = getItemOptions(item);
      const tOptions = t.options ?? [];
      const mergedOptions = groups.map((g) => {
        const tg = tOptions.find((x) => x.id === g.id);
        if (!tg) return g;
        return {
          ...g,
          name: tg.name || g.name,
          choices: g.choices.map((c) => {
            const tc = tg.choices?.find((x) => x.id === c.id);
            return tc ? { ...c, label: tc.label || c.label } : c;
          }),
        };
      });

      existingTranslations[locale] = {
        name: t.name,
        description: t.description ?? '',
        options: tOptions,
      };

      const metadata = mergeItemMetadata(item.metadata, {
        translations: existingTranslations,
        ...(input.replaceLive ? { options: mergedOptions } : {}),
      });

      const { error } = await supabase
        .from('catalog_items')
        .update({
          metadata,
          ...(input.replaceLive
            ? { name: t.name, description: t.description?.trim() || null }
            : {}),
        })
        .eq('id', item.id)
        .eq('organization_id', ctx.organizationId);
      if (!error) updated += 1;
    }

    // Track locale on settings (best-effort)
    try {
      const settings = await getCatalogSettings(supabase, ctx.organizationId);
      const locales = Array.from(new Set([...(settings.locales ?? ['fr']), locale]));
      await supabase
        .from('catalog_settings')
        .update({ locales })
        .eq('organization_id', ctx.organizationId);
    } catch {
      // settings table may not exist yet if migration pending
    }

    revalidatePath('/catalogue');
    return {
      success: input.replaceLive
        ? `Catalogue traduit en ${locale.toUpperCase()} (${updated} article(s) mis à jour).`
        : `Traduction ${locale.toUpperCase()} enregistrée dans les métadonnées (${updated} article(s)).`,
      locale,
      translatedItems: updated,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur traduction' };
  }
}
