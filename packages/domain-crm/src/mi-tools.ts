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

  return {
    organizationId,
    restaurantName: org?.name ?? 'Restaurant',
    timezone,
    currency,
    period: periodMeta,
    dataQuality,
    limits,
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
  };
}
