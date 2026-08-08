/**
 * Openverse image search helpers for catalog menu photos.
 * French dish names often return 0 hits — we build EN cuisine queries + fallbacks.
 */

export interface FreeImageHit {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  score: number;
}

const CATEGORY_EN: Record<string, string> = {
  entrée: 'appetizer',
  entrées: 'appetizer',
  entree: 'appetizer',
  entrees: 'appetizer',
  starter: 'appetizer',
  starters: 'appetizer',
  plat: 'main course',
  plats: 'main course',
  'plat principal': 'main course',
  dessert: 'dessert',
  desserts: 'dessert',
  boisson: 'drink',
  boissons: 'beverage drink',
  cocktail: 'cocktail drink',
  cocktails: 'cocktail drink',
  accompagnement: 'side dish',
  accompagnements: 'side dish',
  sauce: 'sauce',
  sauces: 'sauce',
  pizza: 'pizza',
  burgers: 'burger',
  burger: 'burger',
  grillades: 'grill barbecue',
  grillade: 'grill barbecue',
  salades: 'salad',
  salade: 'salad',
  soupes: 'soup',
  soupe: 'soup',
  poissons: 'fish seafood',
  poisson: 'fish seafood',
  viandes: 'meat',
  viande: 'meat',
  végétarien: 'vegetarian',
  vegetarien: 'vegetarian',
  vegan: 'vegan',
};

/** Common FR menu words → EN (word-level). */
const FOOD_WORD_EN: Record<string, string> = {
  beignet: 'fritter',
  beignets: 'fritters',
  crevette: 'shrimp',
  crevettes: 'shrimp',
  gambas: 'prawns',
  calamars: 'calamari',
  calamar: 'calamari',
  poulet: 'chicken',
  bœuf: 'beef',
  boeuf: 'beef',
  porc: 'pork',
  agneau: 'lamb',
  poisson: 'fish',
  thon: 'tuna',
  saumon: 'salmon',
  cabillaud: 'cod',
  riz: 'rice',
  pâtes: 'pasta',
  pates: 'pasta',
  frites: 'french fries',
  fromage: 'cheese',
  pain: 'bread',
  soupe: 'soup',
  salade: 'salad',
  sandwich: 'sandwich',
  brochette: 'skewer',
  brochettes: 'skewers',
  grillé: 'grilled',
  grille: 'grilled',
  frit: 'fried',
  braisé: 'braised',
  braise: 'braised',
  mijoté: 'stewed',
  mijote: 'stewed',
  fumé: 'smoked',
  fume: 'smoked',
  épicé: 'spicy',
  epice: 'spicy',
  avocat: 'avocado',
  tomate: 'tomato',
  tomates: 'tomato',
  oignon: 'onion',
  ail: 'garlic',
  piment: 'chili pepper',
  mangue: 'mango',
  banane: 'banana',
  plantain: 'plantain',
  manioc: 'cassava',
  attieké: 'attiéké cassava couscous',
  attiéké: 'attiéké cassava couscous',
  alloco: 'fried plantain',
  aloko: 'fried plantain',
  yassa: 'yassa onion sauce',
  mafé: 'mafe peanut stew',
  mafe: 'mafe peanut stew',
  thiéboudienne: 'thieboudienne fish rice',
  thieboudienne: 'thieboudienne fish rice',
  ndolé: 'ndole greens stew',
  ndole: 'ndole greens stew',
  gâteau: 'cake',
  gateau: 'cake',
  tarte: 'pie tart',
  glace: 'ice cream',
  jus: 'juice',
  bière: 'beer',
  biere: 'beer',
  vin: 'wine',
  café: 'coffee',
  cafe: 'coffee',
  thé: 'tea',
  the: 'tea',
  chocolat: 'chocolate',
  vanille: 'vanilla',
  citron: 'lemon',
  ananas: 'pineapple',
  coco: 'coconut',
  arachide: 'peanut',
  arachides: 'peanut',
  burger: 'burger',
  pizza: 'pizza',
  taco: 'taco',
  wrap: 'wrap',
  bowl: 'bowl',
  risotto: 'risotto',
  lasagne: 'lasagna',
  couscous: 'couscous',
  tajine: 'tagine',
  tagine: 'tagine',
  kefta: 'kefta meatball',
  merguez: 'merguez sausage',
  chawarma: 'shawarma',
  shawarma: 'shawarma',
  falafel: 'falafel',
  hummus: 'hummus',
  houmous: 'hummus',
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeKey(s: string): string {
  return stripAccents(s).toLowerCase().trim();
}

export function categoryToEnglish(category?: string): string {
  if (!category?.trim()) return '';
  const key = normalizeKey(category);
  return CATEGORY_EN[key] ?? CATEGORY_EN[key.replace(/s$/, '')] ?? '';
}

/** Translate a French-ish dish name to an English search phrase (best-effort dictionary). */
export function dishNameToEnglish(name: string): string {
  const words = name
    .replace(/[’']/g, ' ')
    .split(/[^a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ0-9]+/)
    .filter(Boolean);

  const out: string[] = [];
  for (const w of words) {
    const key = normalizeKey(w);
    if (key.length < 2) continue;
    const mapped = FOOD_WORD_EN[key] ?? FOOD_WORD_EN[key.replace(/s$/, '')];
    if (mapped) out.push(mapped);
    else if (/^[a-z0-9]+$/i.test(stripAccents(w))) out.push(stripAccents(w).toLowerCase());
  }
  return out.join(' ').trim();
}

/**
 * Ordered Openverse queries to try until results appear.
 * FR dish names alone often return 0 — EN + "food" is required.
 */
export function buildImageSearchQueries(input: {
  name: string;
  category?: string;
}): string[] {
  const name = (input.name ?? '').trim();
  const category = (input.category ?? '').trim();
  const enName = dishNameToEnglish(name);
  const enCat = categoryToEnglish(category);
  const queries: string[] = [];

  const push = (q: string) => {
    const cleaned = q.replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 2 && !queries.includes(cleaned)) queries.push(cleaned);
  };

  if (enName) {
    push(`${enName} ${enCat} food`.trim());
    push(`${enName} dish food photography`);
    push(`${enName} food`);
  }

  push(`${stripAccents(name)} ${enCat || stripAccents(category)} food`.trim());
  push(`${stripAccents(name)} food dish`);

  if (enCat) push(`${enCat} food restaurant`);

  if (enName) {
    const short = enName.split(/\s+/).slice(0, 3).join(' ');
    push(`${short} food`);
  }

  return queries.slice(0, 6);
}

function scoreHit(
  hit: { title?: string; tags?: string[] },
  needles: string[]
): number {
  const hay = `${hit.title ?? ''} ${(hit.tags ?? []).join(' ')}`.toLowerCase();
  let score = 0;
  for (const n of needles) {
    if (!n || n.length < 3) continue;
    if (hay.includes(n.toLowerCase())) score += 3;
  }
  return score;
}

interface OpenverseRaw {
  title?: string;
  url?: string;
  thumbnail?: string;
  source?: string;
  provider?: string;
  tags?: { name?: string }[] | string[];
}

async function fetchOpenversePage(query: string): Promise<OpenverseRaw[]> {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', '12');
  url.searchParams.set('license_type', 'commercial');
  url.searchParams.set('mature', 'false');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LoyalaAI-Catalog/1.0 (menu photos; https://fmagence.online)',
      },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
  } catch {
    return [];
  }

  if (res.status === 429 || res.status >= 500) {
    try {
      await new Promise((r) => setTimeout(r, 600));
      res = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LoyalaAI-Catalog/1.0 (menu photos; https://fmagence.online)',
        },
        signal: AbortSignal.timeout(12_000),
        cache: 'no-store',
      });
    } catch {
      return [];
    }
  }

  if (!res.ok) return [];

  const data = (await res.json()) as { results?: OpenverseRaw[] };
  return data.results ?? [];
}

function tagNames(raw: OpenverseRaw): string[] {
  if (!raw.tags) return [];
  return raw.tags.map((t) => (typeof t === 'string' ? t : t.name ?? '')).filter(Boolean);
}

/** Search Openverse with EN-first query cascade; returns scored unique hits. */
export async function searchMenuImages(input: {
  name: string;
  category?: string;
  limit?: number;
}): Promise<{ results: FreeImageHit[]; queryUsed?: string; error?: string }> {
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 12);
  const queries = buildImageSearchQueries(input);
  if (queries.length === 0) {
    return { results: [], error: 'Saisissez un terme de recherche.' };
  }

  const needles = [
    ...dishNameToEnglish(input.name).split(/\s+/),
    ...categoryToEnglish(input.category).split(/\s+/),
    ...normalizeKey(input.name).split(/\s+/),
  ].filter((w) => w.length >= 3);

  const seen = new Set<string>();
  const collected: FreeImageHit[] = [];
  let queryUsed: string | undefined;

  for (const q of queries) {
    const raw = await fetchOpenversePage(q);
    if (raw.length === 0) continue;
    if (!queryUsed) queryUsed = q;

    for (const r of raw) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      collected.push({
        url: r.url,
        thumbnail: r.thumbnail || r.url,
        title: r.title || 'Sans titre',
        source: r.source || r.provider || 'Openverse',
        score: scoreHit({ title: r.title, tags: tagNames(r) }, needles),
      });
    }

    if (collected.length >= limit) break;
  }

  collected.sort((a, b) => b.score - a.score);
  const results = collected.slice(0, limit);

  if (results.length === 0) {
    return {
      results: [],
      error: 'Aucune image trouvée. Essayez un nom plus simple ou Importer une photo.',
    };
  }

  return { results, queryUsed };
}
