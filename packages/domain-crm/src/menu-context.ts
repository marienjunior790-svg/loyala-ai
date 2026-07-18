import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrganization } from './organizations';
import { listCatalogCategories, listCatalogItems, type CatalogCategory, type CatalogItem } from './catalog';
import { getItemOptions, hasOptions } from './catalog-options';
import { computeCatalogQuality } from './catalog-quality';
import { getAffinitySegments, type AffinitySegments } from './affinity-segments';
import { listClients } from './clients';
import { computeClientSegment, type ClientSegment } from './segments';
import { getLoyaltySummary } from './loyalty';

export type MenuGoal =
  | 'panier_moyen'
  | 'nouveautes'
  | 'marges'
  | 'stocks'
  | 'acquisition'
  | 'fidelisation'
  | 'categorie'
  | 'general';

export type MenuKind =
  | 'jour'
  | 'semaine'
  | 'weekend'
  | 'midi'
  | 'soir'
  | 'degustation'
  | 'enfant'
  | 'famille'
  | 'etudiant'
  | 'entreprise'
  | 'saisonnier'
  | 'evenementiel'
  | 'promotionnel';

export type DietaryConstraint =
  | 'halal'
  | 'vegetarien'
  | 'vegan'
  | 'sans_gluten'
  | 'sans_lactose'
  | 'faible_calorie'
  | 'proteine'
  | 'enfant';

export interface MenuConsultantRequest {
  goal?: MenuGoal;
  menuKind?: MenuKind;
  dietary?: DietaryConstraint[];
  brief?: string;
  establishmentType?: string;
  /** Quick = less context in prompt; advanced = full snapshot */
  mode?: 'quick' | 'advanced';
}

export interface MenuContextSnapshot {
  organization: {
    name: string;
    currency: string;
    country: string;
    timezone: string;
    establishmentType: string;
  };
  season: {
    season: string;
    month: number;
    upcomingEvents: string[];
  };
  catalog: {
    categories: { name: string; itemCount: number }[];
    items: {
      name: string;
      category: string | null;
      type: string;
      price: number;
      hasPhoto: boolean;
      hasOptions: boolean;
      active: boolean;
    }[];
    qualityScore: number;
    withoutImage: number;
    incomplete: number;
  };
  sales: {
    topProducts: { name: string; clientCount: number }[];
    topCategories: { name: string; clientCount: number }[];
    affinityClients: number;
  };
  crm: {
    segments: Record<ClientSegment, number>;
    totalClients: number;
    loyaltyMembers: number;
    loyaltyPointsIssued: number;
  };
  request: MenuConsultantRequest;
  generatedAt: string;
}

const SEASON_BY_MONTH: Record<number, string> = {
  1: 'hiver',
  2: 'hiver',
  3: 'printemps',
  4: 'printemps',
  5: 'printemps',
  6: 'été',
  7: 'été',
  8: 'été',
  9: 'automne',
  10: 'automne',
  11: 'automne',
  12: 'hiver',
};

function upcomingEvents(month: number, day: number): string[] {
  const events: string[] = [];
  if (month === 2 && day <= 14) events.push('Saint-Valentin');
  if (month === 3 || month === 4) events.push('Pâques (période)');
  if (month === 5) events.push('Fête des Mères');
  if (month === 6) events.push('Fête des Pères');
  if (month === 10 && day >= 20) events.push('Halloween');
  if (month === 12) events.push('Noël', 'Fêtes de fin d’année');
  if (month >= 2 && month <= 4) events.push('Ramadan (vérifier calendaire local)');
  return events;
}

function resolveEstablishmentType(
  orgName: string,
  settings: Record<string, unknown>,
  override?: string
): string {
  if (override?.trim()) return override.trim();
  const fromSettings =
    (typeof settings.establishment_type === 'string' && settings.establishment_type) ||
    (typeof settings.sector === 'string' && settings.sector) ||
    (typeof settings.business_type === 'string' && settings.business_type);
  if (fromSettings) return fromSettings;
  return orgName || 'Restaurant';
}

/**
 * Aggregate org + catalog + affinity + CRM signals for menu consulting.
 * Intentionally avoids per-client purchase N+1 queries (v1 performance).
 */
export async function buildMenuContext(
  supabase: SupabaseClient,
  organizationId: string,
  request: MenuConsultantRequest = {}
): Promise<MenuContextSnapshot> {
  const [org, categories, items, affinity, clients, loyalty] = await Promise.all([
    getOrganization(supabase, organizationId),
    listCatalogCategories(supabase, organizationId),
    listCatalogItems(supabase, organizationId, { activeOnly: true }),
    getAffinitySegments(supabase, organizationId, 8).catch(
      (): AffinitySegments => ({ products: [], categories: [], totalClients: 0 })
    ),
    listClients(supabase, organizationId).catch(() => []),
    getLoyaltySummary(supabase, organizationId).catch(() => ({
      totalPoints: 0,
      clientsWithPoints: 0,
      topClients: [] as { full_name: string; loyalty_points: number }[],
    })),
  ]);

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const catName = new Map(categories.map((c: CatalogCategory) => [c.id, c.name]));
  const quality = computeCatalogQuality(categories, items);

  const segmentCounts: Record<ClientSegment, number> = {
    new: 0,
    regular: 0,
    vip: 0,
    inactive: 0,
    at_risk: 0,
  };
  for (const c of clients) {
    const seg = computeClientSegment(c);
    segmentCounts[seg] += 1;
  }

  const itemCap = request.mode === 'quick' ? 40 : 80;
  const slimItems = items.slice(0, itemCap).map((i: CatalogItem) => ({
    name: i.name,
    category: i.category_id ? (catName.get(i.category_id) ?? null) : null,
    type: i.type,
    price: Number(i.price) || 0,
    hasPhoto: Boolean(i.photo_url),
    hasOptions: hasOptions(i),
    active: i.is_active,
  }));

  const categoryStats = categories.map((c) => ({
    name: c.name,
    itemCount: items.filter((i) => i.category_id === c.id).length,
  }));

  return {
    organization: {
      name: org?.name ?? 'Établissement',
      currency: org?.currency ?? 'XOF',
      country: org?.country_code ?? 'SN',
      timezone: org?.timezone ?? 'Africa/Dakar',
      establishmentType: resolveEstablishmentType(
        org?.name ?? '',
        org?.settings ?? {},
        request.establishmentType
      ),
    },
    season: {
      season: SEASON_BY_MONTH[month] ?? 'année',
      month,
      upcomingEvents: upcomingEvents(month, day),
    },
    catalog: {
      categories: categoryStats,
      items: slimItems,
      qualityScore: quality.score,
      withoutImage: quality.kpis.withoutImage,
      incomplete: quality.kpis.incomplete,
    },
    sales: {
      topProducts: affinity.products,
      topCategories: affinity.categories,
      affinityClients: affinity.totalClients,
    },
    crm: {
      segments: segmentCounts,
      totalClients: clients.length,
      loyaltyMembers: loyalty.clientsWithPoints,
      loyaltyPointsIssued: loyalty.totalPoints,
    },
    request: {
      goal: request.goal ?? 'general',
      menuKind: request.menuKind ?? 'jour',
      dietary: request.dietary ?? [],
      brief: request.brief?.trim() || undefined,
      establishmentType: request.establishmentType,
      mode: request.mode ?? 'advanced',
    },
    generatedAt: now.toISOString(),
  };
}

/** Compact text block for LLM prompts (token budget). */
export function formatMenuContextForPrompt(ctx: MenuContextSnapshot): string {
  const lines: string[] = [];
  lines.push(`Établissement: ${ctx.organization.name} (${ctx.organization.establishmentType})`);
  lines.push(
    `Devise: ${ctx.organization.currency} · Pays: ${ctx.organization.country} · Fuseau: ${ctx.organization.timezone}`
  );
  lines.push(
    `Saison: ${ctx.season.season} (mois ${ctx.season.month}) · Événements: ${
      ctx.season.upcomingEvents.join(', ') || 'aucun'
    }`
  );
  lines.push(
    `Objectif: ${ctx.request.goal} · Type de menu: ${ctx.request.menuKind} · Contraintes: ${
      (ctx.request.dietary ?? []).join(', ') || 'aucune'
    }`
  );
  if (ctx.request.brief) lines.push(`Brief: ${ctx.request.brief}`);

  lines.push(
    `Catalogue: score qualité ${ctx.catalog.qualityScore}/100 · ${ctx.catalog.items.length} articles actifs · ${ctx.catalog.withoutImage} sans photo · ${ctx.catalog.incomplete} incomplets`
  );
  lines.push(
    `Catégories: ${
      ctx.catalog.categories.map((c) => `${c.name}(${c.itemCount})`).join(', ') || 'aucune'
    }`
  );

  const sample = ctx.catalog.items
    .slice(0, 35)
    .map(
      (i) =>
        `${i.name}${i.category ? ` [${i.category}]` : ''} ${i.price}${i.hasOptions ? ' +options' : ''}`
    )
    .join(' · ');
  if (sample) lines.push(`Articles (échantillon): ${sample}`);

  if (ctx.sales.topProducts.length) {
    lines.push(
      `Top produits (affinité clients): ${ctx.sales.topProducts
        .map((p) => `${p.name}(${p.clientCount})`)
        .join(', ')}`
    );
  }
  if (ctx.sales.topCategories.length) {
    lines.push(
      `Top catégories: ${ctx.sales.topCategories
        .map((c) => `${c.name}(${c.clientCount})`)
        .join(', ')}`
    );
  }

  const seg = ctx.crm.segments;
  lines.push(
    `CRM: ${ctx.crm.totalClients} clients · VIP ${seg.vip} · réguliers ${seg.regular} · inactifs ${seg.inactive} · à risque ${seg.at_risk} · nouveaux ${seg.new}`
  );
  lines.push(
    `Fidélité: ${ctx.crm.loyaltyMembers} membres · ${ctx.crm.loyaltyPointsIssued} points cumulés`
  );

  lines.push(
    'Contraintes: ne propose QUE des produits actifs du catalogue (ou clairement marqués "à créer"). N’invente pas de prix incohérents. Explique toujours tes choix avec les données ci-dessus.'
  );

  return lines.join('\n');
}

/** Expose option groups presence for future stock/availability filters. */
export function catalogItemHasConfiguredOptions(item: CatalogItem): boolean {
  return getItemOptions(item).length > 0;
}
