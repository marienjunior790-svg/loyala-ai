/**
 * Marketing Intelligence — outils métier déterministes (Phase 1 L1).
 * Lecture seule : réutilise getClientDashboard / computeClientSegment.
 * Aucun INSERT/UPDATE/DELETE.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DASHBOARD_PERIOD_LABELS,
  DASHBOARD_PERIODS,
  getClientDashboard,
  parseDashboardPeriod,
  type ClientDashboard,
  type ClientRank,
  type DashboardClient,
  type DashboardPeriod,
  type ProductStat,
} from './client-dashboard';
import { listAllClients, type Client } from './clients';
import { getOrganization } from './organizations';
import { computeClientSegment, INACTIVE_DAYS_THRESHOLD, type ClientSegment } from './segments';
import {
  buildMiOpportunities,
  buildMiTrends,
  type MiOpportunity,
  type MiTrends,
} from './mi-opportunities';
import {
  buildMiCustomerIntelligence,
  buildMiRetentionStrategies,
  computeMedianRecencyDays,
  type MiCustomerIntelligence,
  type MiRetentionStrategy,
} from './mi-customer-intelligence';
import {
  buildMiCampaignProposals,
  type MiCampaignProposal,
} from './mi-campaign-intelligence';
import {
  buildMiProactiveBriefing,
  type MiProactiveBriefing,
} from './mi-proactive-briefing';
import { computeMiReviewsInsight, type MiReviewsInsight } from './mi-reviews';
import { countReviews, listReviews } from './reviews';
import {
  computeMiRecencyLoyaltyInsight,
  listVisitStampsForLoyalty,
  MI_REPEAT_RATE_WINDOW_DAYS,
  type MiRecencyLoyaltyInsight,
} from './mi-recency-loyalty';
import {
  computeMiCampaignActivityInsight,
  listCampaignsForMi,
  listCampaignSendsForMi,
  type MiCampaignActivityInsight,
} from './mi-campaign-activity';

export type MiDataQuality = 'ok' | 'partial' | 'insufficient';

export const MI_TOP_CLIENTS_MAX = 20;
export const MI_PRODUCTS_MAX = 15;
export const MI_INACTIVE_MAX = 50;

export interface MiPeriodMeta {
  code: DashboardPeriod;
  /** Libellé UI dashboard (ex. « Mois »). */
  label: string;
  from: string;
  to: string;
  /**
   * Les « 30 derniers jours » du langage naturel sont mappés sur la période
   * canonique `mois` du dashboard (du 1er du mois à aujourd’hui), pas sur
   * une fenêtre glissante — pour garantir l’égalité des chiffres.
   */
  definition: string;
}

export interface MiTopClient {
  clientId: string;
  displayName: string;
  /** Téléphone masqué — jamais le numéro complet vers le LLM. */
  phoneMasked: string;
  spent: number;
  visits: number;
  averageBasket: number;
  favoriteProduct: string | null;
}

export interface MiInactiveClient {
  clientId: string;
  displayName: string;
  phoneMasked: string;
  segment: ClientSegment;
  visitCount: number;
  lastVisitAt: string | null;
  totalSpent: number;
}

export interface MiOrgInsights {
  organizationId: string;
  restaurantName: string;
  timezone: string;
  currency: string;
  period: MiPeriodMeta;
  dataQuality: MiDataQuality;
  limits: string[];
  kpis: ClientDashboard['kpis'] | null;
  topClients: MiTopClient[];
  topProducts: Array<Pick<ProductStat, 'name' | 'quantity' | 'revenue' | 'clients'>>;
  topCategories: Array<Pick<ProductStat, 'name' | 'quantity' | 'revenue' | 'clients'>>;
  segments: Record<ClientSegment, number> | null;
  inactiveLoyal: MiInactiveClient[];
  clientCount: number;
  /** Tendances vs période précédente (null si pas de KPIs). */
  trends: MiTrends | null;
  /** Opportunités déterministes classées (vide si données insuffisantes). */
  opportunities: MiOpportunity[];
  /** Intelligence client P2 (métriques + snapshot segments). */
  customerIntelligence: MiCustomerIntelligence;
  /** Stratégies de fidélisation déterministes P2. */
  retentionStrategies: MiRetentionStrategy[];
  /** Propositions de campagne déterministes P3 (brouillons, non persistées). */
  campaignProposals: MiCampaignProposal[];
  /**
   * Mix canaux (part livraison) — P2.3.
   * null si dashboard non chargé ; deliverySharePct null si non calculable.
   */
  channelMix: ClientDashboard['channelMix'] | null;
  /**
   * Avis clients (P2.4) — agrégat périodique ; averageRating null si aucune note valide.
   * null uniquement si le chargement avis a échoué côté loader (sinon objet avec limites).
   */
  reviewsInsight: MiReviewsInsight | null;
  /**
   * Récence / fidélisation (P2.5) — inactifs autrefois réguliers, repeat rate, refroidissement.
   * null si calcul impossible côté loader.
   */
  recencyLoyalty: MiRecencyLoyaltyInsight | null;
  /**
   * Activité campagnes / envois (P2.6) — volumes et taux de marquage CRM.
   * Pas de ROI / opens / delivery WhatsApp.
   */
  campaignActivity: MiCampaignActivityInsight | null;
  /**
   * Fenêtres de mesure distinctes (dashboard ≠ récence glissante ≠ avis/campagnes alignés).
   * Évite de laisser croire que tous les indicateurs couvrent la même période.
   */
  measurementWindows: MiMeasurementWindow[];
  /** Briefing proactif unifié P2.2 (agrège MI + Bomaye CRM). Toujours posé par loadMiOrgInsights. */
  proactiveBriefing?: MiProactiveBriefing;
}

/** Métadonnée de fenêtre temporelle pour API / briefing / cockpit. */
export interface MiMeasurementWindow {
  id: 'dashboard' | 'recency_sliding' | 'reviews' | 'campaigns';
  label: string;
  from: string;
  to: string;
  definition: string;
  /** true si bornes = période dashboard (ou précédente pour chargement). */
  alignedWithDashboard: boolean;
}

export function buildMiMeasurementWindows(input: {
  period: MiPeriodMeta;
  previousFrom: string;
  previousTo: string;
  now: Date;
  timezone: string;
}): MiMeasurementWindow[] {
  const recencyTo = input.period.to;
  const recencyFromDate = new Date(
    input.now.getTime() - MI_REPEAT_RATE_WINDOW_DAYS * 2 * 24 * 60 * 60 * 1000
  );
  const recencyFrom = recencyFromDate.toISOString().slice(0, 10);
  return [
    {
      id: 'dashboard',
      label: `Dashboard / tendances (${input.period.label})`,
      from: input.period.from,
      to: input.period.to,
      definition: input.period.definition,
      alignedWithDashboard: true,
    },
    {
      id: 'recency_sliding',
      label: 'Récence / fidélisation (120 j glissants)',
      from: recencyFrom,
      to: recencyTo,
      definition: `Fenêtre glissante ${MI_REPEAT_RATE_WINDOW_DAYS * 2} j jusqu’à aujourd’hui (fuseau ${input.timezone}) — distincte de la période dashboard. Repeat rate compare 0–${MI_REPEAT_RATE_WINDOW_DAYS} j vs ${MI_REPEAT_RATE_WINDOW_DAYS}–${MI_REPEAT_RATE_WINDOW_DAYS * 2} j.`,
      alignedWithDashboard: false,
    },
    {
      id: 'reviews',
      label: `Avis (alignés période ${input.period.label})`,
      from: input.period.from,
      to: input.period.to,
      definition: `Notes/tendance sur la période dashboard ; chargement depuis le début de la fenêtre précédente (${input.previousFrom}) pour comparer. Fuseau ${input.timezone}.`,
      alignedWithDashboard: true,
    },
    {
      id: 'campaigns',
      label: `Campagnes / envois (alignés période ${input.period.label})`,
      from: input.period.from,
      to: input.period.to,
      definition: `Activité datée sur la période dashboard ; échantillon chargé depuis ${input.previousFrom}. Fuseau ${input.timezone}.`,
      alignedWithDashboard: true,
    },
  ];
}

const PERIOD_DEFINITIONS: Record<DashboardPeriod, string> = {
  semaine: 'Du lundi de la semaine en cours jusqu’à aujourd’hui (fuseau du restaurant).',
  mois: 'Du 1er du mois calendaire en cours jusqu’à aujourd’hui (équivalent dashboard « Mois » / ~30 j).',
  '3mois': 'Du 1er du mois il y a deux mois jusqu’à aujourd’hui.',
  annee: 'Du 1er janvier de l’année en cours jusqu’à aujourd’hui.',
};

/** Normalise une intention temporelle vers une période dashboard canonique. */
export function resolveMiPeriod(raw: unknown): DashboardPeriod {
  if (typeof raw === 'string') {
    const v = raw.toLowerCase().trim();
    if (v === '30' || v.includes('30') || v.includes('trente')) return 'mois';
    if (v.includes('semaine') || v === 'week' || v === '7') return 'semaine';
    if (v.includes('3') && v.includes('mois')) return '3mois';
    if (v.includes('an') || v.includes('year') || v.includes('12')) return 'annee';
    if (v.includes('mois') || v.includes('month')) return 'mois';
  }
  return parseDashboardPeriod(raw);
}

export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-2)}`;
}

function toDashboardClients(clients: Client[]): DashboardClient[] {
  return clients.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    created_at: c.created_at,
    total_spent: c.total_spent,
    visit_count: c.visit_count,
    last_visit_at: c.last_visit_at,
  }));
}

function rankToMi(row: ClientRank): MiTopClient {
  return {
    clientId: row.clientId,
    displayName: row.name,
    phoneMasked: maskPhone(row.phone),
    spent: row.spent,
    visits: row.visits,
    averageBasket: row.averageBasket,
    favoriteProduct: row.favoriteProduct,
  };
}

export function buildMiPeriodMeta(dashboard: ClientDashboard): MiPeriodMeta {
  return {
    code: dashboard.period,
    label: DASHBOARD_PERIOD_LABELS[dashboard.period],
    from: dashboard.range.start,
    to: dashboard.range.end,
    definition: PERIOD_DEFINITIONS[dashboard.period],
  };
}

/** Extrait le classement canonique `dashboard.ranking` (même ordre / montants). */
export function listTopClientsFromDashboard(
  dashboard: ClientDashboard,
  limit = 10
): MiTopClient[] {
  const capped = Math.min(Math.max(1, limit), MI_TOP_CLIENTS_MAX);
  return dashboard.ranking.slice(0, capped).map(rankToMi);
}

export function listPopularProductsFromDashboard(
  dashboard: ClientDashboard,
  limit = 10
): ProductStat[] {
  const capped = Math.min(Math.max(1, limit), MI_PRODUCTS_MAX);
  return dashboard.topProducts.slice(0, capped);
}

/**
 * Clients fidèles inactifs : segment inactive|at_risk, minVisits, calcul mémoire
 * (computeClientSegment) — pas de sync DB.
 */
export function listInactiveLoyalClients(
  clients: Client[],
  options?: { minVisits?: number; limit?: number; now?: Date }
): MiInactiveClient[] {
  const minVisits = options?.minVisits ?? 2;
  const limit = Math.min(Math.max(1, options?.limit ?? 20), MI_INACTIVE_MAX);
  const rows: MiInactiveClient[] = [];

  for (const c of clients) {
    const segment = computeClientSegment(c);
    if (segment !== 'inactive' && segment !== 'at_risk') continue;
    if ((c.visit_count ?? 0) < minVisits) continue;
    rows.push({
      clientId: c.id,
      displayName: c.full_name,
      phoneMasked: maskPhone(c.phone_e164 || c.phone),
      segment,
      visitCount: c.visit_count ?? 0,
      lastVisitAt: c.last_visit_at,
      totalSpent: Number(c.total_spent ?? 0),
    });
  }

  rows.sort((a, b) => b.totalSpent - a.totalSpent || b.visitCount - a.visitCount);
  return rows.slice(0, limit);
}

/** Évalue la qualité des données pour le grounding MI (exporté pour tests). */
export function assessMiDataQuality(input: {
  clientCount: number;
  rankingLen: number;
  productsLen: number;
  hasItemsTable: boolean;
}): { dataQuality: MiDataQuality; limits: string[] } {
  const limits: string[] = [];
  if (input.clientCount === 0) {
    return {
      dataQuality: 'insufficient',
      limits: ['Aucun client actif dans cette organisation.'],
    };
  }
  if (input.rankingLen === 0) {
    limits.push(
      `Aucune commande payée sur la période sélectionnée (seuil d’inactivité segments : ${INACTIVE_DAYS_THRESHOLD} j).`
    );
    return { dataQuality: 'insufficient', limits };
  }
  if (!input.hasItemsTable || input.productsLen === 0) {
    limits.push('Détail produits indisponible ou vide (visit_items manquant ou sans lignes).');
    return { dataQuality: 'partial', limits };
  }
  return { dataQuality: 'ok', limits };
}

export interface LoadMiOrgInsightsOptions {
  period?: unknown;
  timezone?: string;
  now?: Date;
  topClientsLimit?: number;
  productsLimit?: number;
  inactiveLimit?: number;
  inactiveMinVisits?: number;
}

/**
 * Charge le snapshot MI via les fonctions canoniques du dashboard clients.
 * Utilise le client Supabase de l’utilisateur (RLS) — jamais service_role.
 */
export async function loadMiOrgInsights(
  supabase: SupabaseClient,
  organizationId: string,
  options: LoadMiOrgInsightsOptions = {}
): Promise<MiOrgInsights> {
  const period = resolveMiPeriod(options.period ?? 'mois');
  if (!DASHBOARD_PERIODS.includes(period)) {
    throw new Error(`Période MI invalide: ${period}`);
  }

  const org = await getOrganization(supabase, organizationId);
  const timezone = options.timezone ?? org?.timezone ?? 'Africa/Dakar';
  const clients = await listAllClients(supabase, organizationId);
  const dashboardClients = toDashboardClients(clients);

  const dashboard = await getClientDashboard(supabase, organizationId, {
    clients: dashboardClients,
    period,
    timezone,
    now: options.now,
  });

  const topClients = listTopClientsFromDashboard(dashboard, options.topClientsLimit ?? 10);
  const topProducts = listPopularProductsFromDashboard(dashboard, options.productsLimit ?? 10);
  const inactiveLoyal = listInactiveLoyalClients(clients, {
    minVisits: options.inactiveMinVisits ?? 2,
    limit: options.inactiveLimit ?? 20,
    now: options.now,
  });

  const { dataQuality, limits } = assessMiDataQuality({
    clientCount: clients.length,
    rankingLen: dashboard.ranking.length,
    productsLen: dashboard.topProducts.length,
    hasItemsTable: dashboard.topProducts.length > 0 || dashboard.topCategories.length > 0,
  });

  const periodMeta = buildMiPeriodMeta(dashboard);
  const currency = org?.currency ?? 'XOF';
  const trends = dataQuality === 'insufficient' ? null : buildMiTrends(dashboard.kpis, periodMeta);
  const opportunities = buildMiOpportunities({
    period: periodMeta,
    dataQuality,
    kpis: dashboard.kpis,
    segments: dashboard.segments,
    inactiveLoyal,
    currency,
  });

  const now = options.now ?? new Date();
  const medianRecencyDays = computeMedianRecencyDays(clients, now);
  const customerIntelligence = buildMiCustomerIntelligence({
    period: periodMeta,
    dataQuality,
    kpis: dashboard.kpis,
    segments: dashboard.segments,
    clientCount: clients.length,
    medianRecencyDays,
    currency,
  });
  const retentionStrategies = buildMiRetentionStrategies({
    period: periodMeta,
    dataQuality,
    segments: dashboard.segments,
    inactiveLoyal,
    topClients,
    kpis: dashboard.kpis,
    clientCount: clients.length,
    currency,
  });
  const restaurantName = org?.name ?? 'Restaurant';
  const campaignProposals = buildMiCampaignProposals({
    period: periodMeta,
    dataQuality,
    restaurantName,
    currency,
    retentionStrategies,
    topProducts,
    topClients,
    inactiveLoyal,
    segments: dashboard.segments,
    clientCount: clients.length,
  });

  const channelLimits =
    dashboard.channelMix.limitations.length > 0
      ? [...limits, ...dashboard.channelMix.limitations]
      : limits;

  // P2.4 — avis (RLS org) : période courante + précédente pour tendance éventuelle.
  const reviewsFetchLimit = 200;
  const reviewsSince = `${dashboard.range.previous.start}T00:00:00Z`;
  let reviewsInsight: MiReviewsInsight | null = null;
  try {
    const [reviewRows, totalMatching] = await Promise.all([
      listReviews(supabase, organizationId, {
        limit: reviewsFetchLimit,
        reviewedSince: reviewsSince,
      }),
      countReviews(supabase, organizationId, { reviewedSince: reviewsSince }),
    ]);
    reviewsInsight = computeMiReviewsInsight({
      reviews: reviewRows,
      period: {
        from: periodMeta.from,
        to: periodMeta.to,
        label: periodMeta.label,
      },
      previousPeriod: {
        from: dashboard.range.previous.start,
        to: dashboard.range.previous.end,
      },
      timezone,
      sampleFetchLimit: reviewsFetchLimit,
      totalMatchingInWindow: totalMatching,
    });
  } catch {
    reviewsInsight = null;
  }

  const reviewLimits =
    reviewsInsight == null
      ? [
          ...channelLimits,
          'P2.4 : avis clients indisponibles (lecture reviews en échec) — note non inventée.',
        ]
      : reviewsInsight.limitations.length > 0
        ? [...channelLimits, ...reviewsInsight.limitations]
        : channelLimits;

  // P2.5 — récence / fidélisation (clients déjà chargés + timbres visite 120 j).
  let recencyLoyalty: MiRecencyLoyaltyInsight | null = null;
  try {
    const sinceMs = now.getTime() - MI_REPEAT_RATE_WINDOW_DAYS * 2 * 24 * 60 * 60 * 1000;
    const visitStamps = await listVisitStampsForLoyalty(
      supabase,
      organizationId,
      new Date(sinceMs).toISOString(),
      { limit: 2000 }
    );
    recencyLoyalty = computeMiRecencyLoyaltyInsight({
      clients,
      visits: visitStamps,
      now,
    });
  } catch {
    try {
      recencyLoyalty = computeMiRecencyLoyaltyInsight({ clients, now });
    } catch {
      recencyLoyalty = null;
    }
  }

  const recencyLimits =
    recencyLoyalty == null
      ? [
          ...reviewLimits,
          'P2.5 : récence/fidélisation indisponible — repeat rate non inventé.',
        ]
      : recencyLoyalty.limitations.length > 0
        ? [...reviewLimits, ...recencyLoyalty.limitations]
        : reviewLimits;

  // P2.6 — activité campagnes / envois (RLS org), depuis début fenêtre précédente.
  let campaignActivity: MiCampaignActivityInsight | null = null;
  try {
    const campSince = `${dashboard.range.previous.start}T00:00:00Z`;
    const [campaignRows, sendRows] = await Promise.all([
      listCampaignsForMi(supabase, organizationId, {
        limit: 100,
        createdSince: campSince,
      }),
      listCampaignSendsForMi(supabase, organizationId, {
        limit: 500,
        createdSince: campSince,
      }),
    ]);
    campaignActivity = computeMiCampaignActivityInsight({
      campaigns: campaignRows,
      sends: sendRows,
      period: {
        from: periodMeta.from,
        to: periodMeta.to,
        label: periodMeta.label,
      },
      timezone,
    });
  } catch {
    campaignActivity = null;
  }

  const campaignLimits =
    campaignActivity == null
      ? [
          ...recencyLimits,
          'P2.6 : activité campagnes indisponible — ROI/taux d’ouverture non inventés.',
        ]
      : campaignActivity.limitations.length > 0
        ? [...recencyLimits, ...campaignActivity.limitations]
        : recencyLimits;

  const measurementWindows = buildMiMeasurementWindows({
    period: periodMeta,
    previousFrom: dashboard.range.previous.start,
    previousTo: dashboard.range.previous.end,
    now,
    timezone,
  });

  const snapshotWithoutBriefing = {
    organizationId,
    restaurantName,
    timezone,
    currency,
    period: periodMeta,
    dataQuality,
    limits: campaignLimits,
    kpis: dashboard.kpis,
    topClients,
    topProducts,
    topCategories: dashboard.topCategories.slice(0, options.productsLimit ?? 10),
    segments: dashboard.segments,
    inactiveLoyal,
    clientCount: clients.length,
    trends,
    opportunities,
    customerIntelligence,
    retentionStrategies,
    campaignProposals,
    channelMix: dashboard.channelMix,
    reviewsInsight,
    recencyLoyalty,
    campaignActivity,
    measurementWindows,
  };

  const proactiveBriefing = buildMiProactiveBriefing(snapshotWithoutBriefing);

  return {
    ...snapshotWithoutBriefing,
    proactiveBriefing,
  };
}

/** Payload JSON sûr pour le LLM (pas de téléphone complet). */
export function miInsightsForPrompt(insights: MiOrgInsights): Record<string, unknown> {
  return {
    restaurantName: insights.restaurantName,
    currency: insights.currency,
    timezone: insights.timezone,
    period: insights.period,
    dataQuality: insights.dataQuality,
    limits: insights.limits,
    clientCount: insights.clientCount,
    kpis: insights.kpis,
    topClients: insights.topClients,
    topProducts: insights.topProducts,
    topCategories: insights.topCategories,
    segments: insights.segments,
    inactiveLoyal: insights.inactiveLoyal,
    trends: insights.trends,
    opportunities: insights.opportunities,
    customerIntelligence: insights.customerIntelligence,
    retentionStrategies: insights.retentionStrategies,
    campaignProposals: insights.campaignProposals,
    channelMix: insights.channelMix,
    reviewsInsight: insights.reviewsInsight,
    recencyLoyalty: insights.recencyLoyalty,
    campaignActivity: insights.campaignActivity,
    measurementWindows: insights.measurementWindows,
    proactiveBriefing: insights.proactiveBriefing,
  };
}
