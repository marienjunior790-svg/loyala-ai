import { loadAIConfig } from '../config';

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

export interface GenerateImagesParams {
  prompt: string;
  count?: number;
  size?: ImageSize;
}

export interface ProductImageContext {
  name: string;
  category?: string;
  type?: string;
  establishment?: string;
}

/** Build a context-aware, non-generic prompt for a product/service photo. */
export function buildProductImagePrompt(ctx: ProductImageContext): string {
  const subject = ctx.category ? `${ctx.name} — ${ctx.category}` : ctx.name;
  const context = ctx.establishment ? ` (établissement : ${ctx.establishment})` : '';
  if (ctx.type === 'service' || ctx.type === 'rental') {
    return `Photographie professionnelle et réaliste illustrant précisément : ${subject}${context}. Cadrage soigné, éclairage naturel, ambiance premium et moderne. Aucun texte, aucun watermark, aucune personne identifiable.`;
  }
  return `Photographie culinaire professionnelle en gros plan représentant fidèlement : ${subject}${context}. Présentation appétissante et réaliste, éclairage naturel doux, fond épuré et élégant, style carte de restaurant premium, haute qualité, photoréaliste. Aucun texte, aucun watermark, aucune personne.`;
}

interface ImageApiResponse {
  data?: { b64_json?: string; url?: string }[];
  error?: { message?: string };
}

async function generateSingleImage(
  apiKey: string,
  model: string,
  prompt: string,
  size: ImageSize
): Promise<string | null> {
  // Newer OpenAI image models (gpt-image-*) reject `response_format`.
  // Omit it for all models and accept either b64_json or url in the response.
  const body: Record<string, unknown> = { model, prompt, n: 1, size };

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI Images ${res.status}: ${errText.slice(0, 240)}`);
  }

  const data = (await res.json()) as ImageApiResponse;
  const first = data.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  return null;
}

/**
 * Generate one or more product images via the OpenAI Images API.
 * Requests run in parallel to stay within upstream proxy timeouts.
 * Returns data URLs (base64) — the caller persists them to storage.
 */
export async function generateImages(params: GenerateImagesParams): Promise<string[]> {
  const config = loadAIConfig();
  const apiKey = config.openaiApiKey;
  if (!apiKey) {
    throw new Error("Génération d'image indisponible : clé OpenAI non configurée.");
  }

  const model = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
  const count = Math.min(Math.max(params.count ?? 2, 1), 3);
  const size = params.size ?? '1024x1024';

  const settled = await Promise.allSettled(
    Array.from({ length: count }, () => generateSingleImage(apiKey, model, params.prompt, size))
  );

  const images = settled
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v): v is string => Boolean(v));

  if (images.length === 0) {
    const firstError = settled.find((r) => r.status === 'rejected') as
      | PromiseRejectedResult
      | undefined;
    throw new Error(
      firstError?.reason instanceof Error
        ? firstError.reason.message
        : 'Aucune image générée.'
    );
  }

  return images;
}
