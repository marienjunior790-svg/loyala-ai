'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { updateCatalogItem, getOrganization } from '@loyala/domain-crm';
import { uploadCatalogImage } from '@loyala/integrations';
import { proxyToWorker } from '@/lib/worker/client';

const WRITE = 'clients:write' as const;

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1|0\.0\.0\.0)|\.local$/i;
const MAX_IMAGE_BYTES = 8_000_000;

export type ProductImageGenerateState = {
  error?: string;
  images?: string[];
};

/** Generate AI product image variants (returns base64 data URLs — not yet stored). */
export async function generateProductImagesAction(input: {
  name: string;
  category?: string;
  type?: string;
  count?: number;
}): Promise<ProductImageGenerateState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const name = (input.name ?? '').trim();
    if (name.length < 2) return { error: 'Nom du produit manquant.' };

    const supabase = await createClient();
    const org = await getOrganization(supabase, ctx.organizationId);

    const result = await proxyToWorker<{ images?: string[] }>('catalog/image', {
      method: 'POST',
      organizationId: ctx.organizationId,
      body: {
        name,
        category: input.category,
        type: input.type,
        establishment: org?.name,
        count: Math.min(Math.max(input.count ?? 2, 1), 3),
      },
    });

    if (!result.ok) return { error: result.error ?? 'Génération IA indisponible' };
    const images = Array.isArray(result.data.images) ? result.data.images : [];
    if (images.length === 0) return { error: 'Aucune image générée. Réessayez.' };
    return { images };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur génération d'image" };
  }
}

export interface FreeImageSuggestion {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
}

export type FreeImageSearchState = {
  error?: string;
  results?: FreeImageSuggestion[];
};

/** Search royalty-free (CC) images via the Openverse API (no key required). */
export async function searchFreeImagesAction(input: {
  query: string;
}): Promise<FreeImageSearchState> {
  try {
    await requireAuthPermission(WRITE);
    const query = (input.query ?? '').trim();
    if (query.length < 2) return { error: 'Saisissez un terme de recherche.' };

    const url = new URL('https://api.openverse.org/v1/images/');
    url.searchParams.set('q', query);
    url.searchParams.set('page_size', '12');
    url.searchParams.set('license_type', 'commercial');
    url.searchParams.set('mature', 'false');

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'LoyalaAI-Catalog/1.0' },
        signal: AbortSignal.timeout(12_000),
        cache: 'no-store',
      });
    } catch {
      return { error: 'Recherche d\u2019images indisponible pour le moment.' };
    }
    if (!res.ok) return { error: `La recherche a répondu ${res.status}` };

    const data = (await res.json()) as {
      results?: {
        title?: string;
        url?: string;
        thumbnail?: string;
        source?: string;
        provider?: string;
      }[];
    };

    const results: FreeImageSuggestion[] = (data.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        url: r.url!,
        thumbnail: r.thumbnail || r.url!,
        title: r.title || 'Sans titre',
        source: r.source || r.provider || 'Openverse',
      }));

    if (results.length === 0) return { error: 'Aucune image trouvée. Essayez un autre terme.' };
    return { results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur de recherche' };
  }
}

export type SaveProductImageState = {
  error?: string;
  url?: string;
};

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } | null {
  const match = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1] ?? 'image/webp';
  const bytes = Uint8Array.from(Buffer.from(match[2] ?? '', 'base64'));
  const ext = contentType.split('/')[1]?.split('+')[0] ?? 'webp';
  return { bytes, contentType, ext };
}

async function fetchExternalImage(
  rawUrl: string
): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | { error: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: 'URL image invalide' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Seules les URL http(s) sont autorisées' };
  }
  if (PRIVATE_HOST.test(url.hostname)) return { error: 'Adresse non autorisée' };

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'LoyalaAI-Catalog/1.0' },
    });
  } catch {
    return { error: 'Téléchargement de l\u2019image impossible' };
  }
  if (!res.ok) return { error: `L\u2019image a répondu ${res.status}` };

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) return { error: 'Ce lien ne pointe pas vers une image' };

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) return { error: 'Image trop volumineuse' };
  const ext = contentType.split('/')[1]?.split(';')[0]?.split('+')[0] ?? 'jpg';
  return { bytes: new Uint8Array(buffer), contentType: contentType.split(';')[0] ?? contentType, ext };
}

/**
 * Persist a product image from any source (AI base64, uploaded/compressed data URL,
 * or an external free-image URL), re-hosted in org-scoped storage. Optionally links
 * it to a catalog item.
 */
export async function saveProductImageAction(input: {
  itemId?: string;
  dataUrl?: string;
  externalUrl?: string;
}): Promise<SaveProductImageState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();

    let decoded: { bytes: Uint8Array; contentType: string; ext: string } | null = null;

    if (input.dataUrl) {
      decoded = decodeDataUrl(input.dataUrl);
      if (!decoded) return { error: 'Image invalide' };
      if (decoded.bytes.byteLength > MAX_IMAGE_BYTES) return { error: 'Image trop volumineuse' };
    } else if (input.externalUrl) {
      const fetched = await fetchExternalImage(input.externalUrl);
      if ('error' in fetched) return { error: fetched.error };
      decoded = fetched;
    } else {
      return { error: 'Aucune image fournie' };
    }

    const publicUrl = await uploadCatalogImage(supabase, ctx.organizationId, decoded.bytes, {
      contentType: decoded.contentType,
      ext: decoded.ext,
    });

    if (input.itemId) {
      await updateCatalogItem(supabase, ctx.organizationId, input.itemId, { photoUrl: publicUrl });
      revalidatePath('/catalogue');
    }

    return { url: publicUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur d'enregistrement d'image" };
  }
}
