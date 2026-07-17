import type { CatalogCategory, CatalogItem } from './catalog';
import { getItemOptions, hasOptions } from './catalog-options';
import { suggestVariants } from './catalog-suggestions';

export type CatalogRecommendationKind =
  | 'missing_image'
  | 'missing_description'
  | 'missing_price'
  | 'missing_variants'
  | 'unbalanced_category'
  | 'incoherent_price'
  | 'inactive_share'
  | 'missing_availability';

export interface CatalogRecommendation {
  kind: CatalogRecommendationKind;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  itemIds?: string[];
  categoryId?: string;
}

export interface CatalogQualityBreakdown {
  images: number;
  descriptions: number;
  prices: number;
  variants: number;
  categories: number;
  availability: number;
  highlight: number;
}

export interface CatalogKpis {
  products: number;
  services: number;
  rentals: number;
  categories: number;
  variants: number;
  withoutImage: number;
  incomplete: number;
  withOptions: number;
  active: number;
  inactive: number;
  completionPct: number;
  qualityScore: number;
}

export interface CatalogQualityReport {
  score: number;
  breakdown: CatalogQualityBreakdown;
  kpis: CatalogKpis;
  recommendations: CatalogRecommendation[];
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function isIncomplete(item: CatalogItem): boolean {
  return (
    !item.photo_url ||
    !item.description?.trim() ||
    !(Number(item.price) > 0) ||
    !item.category_id
  );
}

function hasAnyAvailability(item: CatalogItem): boolean {
  const groups = getItemOptions(item);
  return groups.some((g) => g.choices.some((c) => Boolean(c.availability)));
}

/**
 * Pure quality score (0–100) + KPIs + actionable recommendations.
 * Deterministic — safe to run after every catalog mutation.
 */
export function computeCatalogQuality(
  categories: CatalogCategory[],
  items: CatalogItem[]
): CatalogQualityReport {
  const total = items.length;
  const withImage = items.filter((i) => Boolean(i.photo_url)).length;
  const withDesc = items.filter((i) => Boolean(i.description?.trim())).length;
  const withPrice = items.filter((i) => Number(i.price) > 0).length;
  const withVariants = items.filter((i) => hasOptions(i)).length;
  const withAvail = items.filter((i) => hasAnyAvailability(i) || i.is_active).length;
  // "highlight" proxy: active items with photo + description + price (ready to promote)
  const highlighted = items.filter(
    (i) => i.is_active && i.photo_url && i.description?.trim() && Number(i.price) > 0
  ).length;

  const ratio = (n: number) => (total === 0 ? 0 : (n / total) * 100);

  // Category balance: penalize empty cats and extreme skew
  let categoryScore = 0;
  if (categories.length === 0 && total === 0) {
    categoryScore = 0;
  } else if (categories.length === 0 && total > 0) {
    categoryScore = 30;
  } else {
    const counts = categories.map(
      (c) => items.filter((i) => i.category_id === c.id).length
    );
    const used = counts.filter((n) => n > 0).length;
    const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
    const variance =
      counts.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, counts.length);
    const balance = avg === 0 ? 0 : Math.max(0, 100 - (Math.sqrt(variance) / avg) * 40);
    categoryScore = (used / categories.length) * 60 + balance * 0.4;
  }

  const breakdown: CatalogQualityBreakdown = {
    images: clamp(ratio(withImage)),
    descriptions: clamp(ratio(withDesc)),
    prices: clamp(ratio(withPrice)),
    variants: clamp(ratio(withVariants)),
    categories: clamp(categoryScore),
    availability: clamp(ratio(withAvail)),
    highlight: clamp(ratio(highlighted)),
  };

  // Weighted score
  const score = clamp(
    breakdown.images * 0.2 +
      breakdown.descriptions * 0.15 +
      breakdown.prices * 0.15 +
      breakdown.variants * 0.15 +
      breakdown.categories * 0.15 +
      breakdown.availability * 0.1 +
      breakdown.highlight * 0.1
  );

  const variantCount = items.reduce((n, i) => {
    return (
      n +
      getItemOptions(i).reduce((m, g) => m + g.choices.length, 0)
    );
  }, 0);

  const incomplete = items.filter(isIncomplete).length;
  const withoutImage = total - withImage;
  const kpis: CatalogKpis = {
    products: items.filter((i) => i.type === 'product').length,
    services: items.filter((i) => i.type === 'service').length,
    rentals: items.filter((i) => i.type === 'rental').length,
    categories: categories.length,
    variants: variantCount,
    withoutImage,
    incomplete,
    withOptions: withVariants,
    active: items.filter((i) => i.is_active).length,
    inactive: items.filter((i) => !i.is_active).length,
    completionPct: clamp(100 - (total === 0 ? 100 : (incomplete / total) * 100)),
    qualityScore: score,
  };

  const recommendations: CatalogRecommendation[] = [];

  if (withoutImage > 0) {
    recommendations.push({
      kind: 'missing_image',
      severity: withoutImage > total * 0.4 ? 'high' : 'medium',
      title: `${withoutImage} produit(s) sans photo`,
      detail: 'Illustrez-les via IA, recherche libre ou import pour booster le score images.',
      itemIds: items.filter((i) => !i.photo_url).map((i) => i.id).slice(0, 40),
    });
  }

  const noDesc = items.filter((i) => !i.description?.trim());
  if (noDesc.length > 0) {
    recommendations.push({
      kind: 'missing_description',
      severity: 'medium',
      title: `${noDesc.length} description(s) manquante(s)`,
      detail: 'Demandez à l’assistant IA de réécrire les descriptions marketing.',
      itemIds: noDesc.map((i) => i.id).slice(0, 40),
    });
  }

  const noPrice = items.filter((i) => !(Number(i.price) > 0));
  if (noPrice.length > 0) {
    recommendations.push({
      kind: 'missing_price',
      severity: 'high',
      title: `${noPrice.length} produit(s) sans prix`,
      detail: 'Un prix à 0 bloque la vente et fausse le panier moyen.',
      itemIds: noPrice.map((i) => i.id),
    });
  }

  const missVariants = items.filter((i) => {
    if (hasOptions(i)) return false;
    return suggestVariants(i.name, i.catalog_categories?.name).length > 0;
  });
  if (missVariants.length > 0) {
    recommendations.push({
      kind: 'missing_variants',
      severity: 'medium',
      title: `${missVariants.length} produit(s) sans variantes pertinentes`,
      detail: 'Pizza, café, burger… méritent souvent taille, cuisson ou suppléments.',
      itemIds: missVariants.map((i) => i.id).slice(0, 40),
    });
  }

  // Price outliers within category (simple IQR-ish: > 3× median)
  for (const cat of categories) {
    const prices = items
      .filter((i) => i.category_id === cat.id && Number(i.price) > 0)
      .map((i) => Number(i.price))
      .sort((a, b) => a - b);
    if (prices.length < 4) continue;
    const median = prices[Math.floor(prices.length / 2)] ?? 0;
    if (median <= 0) continue;
    const outliers = items.filter(
      (i) =>
        i.category_id === cat.id &&
        Number(i.price) > 0 &&
        (Number(i.price) > median * 3 || Number(i.price) < median / 3)
    );
    if (outliers.length > 0) {
      recommendations.push({
        kind: 'incoherent_price',
        severity: 'low',
        title: `Prix incohérents dans « ${cat.name} »`,
        detail: `${outliers.length} article(s) s’écartent fortement de la médiane (${Math.round(median)}).`,
        itemIds: outliers.map((i) => i.id),
        categoryId: cat.id,
      });
    }
  }

  const emptyCats = categories.filter(
    (c) => !items.some((i) => i.category_id === c.id)
  );
  if (emptyCats.length > 0) {
    recommendations.push({
      kind: 'unbalanced_category',
      severity: 'low',
      title: `${emptyCats.length} catégorie(s) vide(s)`,
      detail: 'Ajoutez des produits ou archivez les catégories inutilisées.',
      categoryId: emptyCats[0]?.id,
    });
  }

  // Suggest missing product families when catalog is thin
  if (total > 0 && total < 8) {
    recommendations.push({
      kind: 'missing_description',
      severity: 'low',
      title: 'Catalogue encore léger',
      detail: 'L’assistant peut proposer desserts, boissons ou accompagnements manquants.',
    });
  }

  recommendations.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  return { score, breakdown, kpis, recommendations: recommendations.slice(0, 12) };
}
