/**
 * Présentation structurée des insights MI — uniquement à partir du payload API.
 * Aucun chiffre de démonstration.
 */

export interface MiInsightKpis {
  revenue: number;
  visits: number;
  averageBasket: number;
  /** Alias d’affichage de clientsServed (dashboard CRM). */
  activeClients: number;
  previousRevenue: number | null;
  previousVisits: number | null;
  previousAverageBasket: number | null;
  previousClientsServed: number | null;
  newClients: number | null;
  previousNewClients: number | null;
  returningClients: number | null;
  frequency: number | null;
}

export interface MiInsightTrendPoint {
  current: number;
  previous: number;
  changePct: number | null;
  significant: boolean;
}

export interface MiInsightTrends {
  revenue: MiInsightTrendPoint;
  visits: MiInsightTrendPoint;
  clientsServed: MiInsightTrendPoint;
  averageBasket: MiInsightTrendPoint;
  newClients: MiInsightTrendPoint;
  comparisonNote: string;
}

export interface MiInsightOpportunity {
  id: string;
  ruleId: string;
  priority: 'high' | 'medium' | 'low';
  facts: string[];
  detectionRule: string;
  period: { code: string; label: string; from: string; to: string };
  limits: string[];
  suggestedAction: string;
}

export interface MiInsightClientRow {
  clientId: string;
  displayName: string;
  phoneMasked: string;
  spent: number;
  visits: number;
  averageBasket: number;
  favoriteProduct: string | null;
}

export interface MiInsightProductRow {
  name: string;
  quantity: number;
  revenue: number;
  clients: number;
}

export interface MiInsightInactiveRow {
  clientId: string;
  displayName: string;
  phoneMasked: string;
  segment: string;
  visitCount: number;
  lastVisitAt: string | null;
  totalSpent: number;
}

export interface MiInsightCustomerMetric {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  source: string;
  periodScope: string;
  inclusionRules: string;
  limits: string[];
  zeroMeans: string;
}

export interface MiInsightRetentionStrategy {
  id: string;
  ruleId: string;
  priority: 'high' | 'medium' | 'low';
  segmentKey: string;
  headcount: number;
  selectionCriteria: string;
  facts: string[];
  period: { code: string; label: string; from: string; to: string };
  marketingObjective: string;
  suggestedAction: string;
  limits: string[];
  confidence: 'low' | 'medium';
}

export interface MiInsightCustomerIntelligence {
  metrics: MiInsightCustomerMetric[];
  segmentCounts: Record<string, number> | null;
  evolutionAvailable: boolean;
  evolutionNote: string | null;
  medianRecencyDays: number | null;
}

export interface MiFormattedInsights {
  dataQuality: 'ok' | 'partial' | 'insufficient' | 'unknown';
  limits: string[];
  currency: string;
  restaurantName: string | null;
  clientCount: number | null;
  kpis: MiInsightKpis | null;
  trends: MiInsightTrends | null;
  opportunities: MiInsightOpportunity[];
  customerIntelligence: MiInsightCustomerIntelligence | null;
  retentionStrategies: MiInsightRetentionStrategy[];
  topClients: MiInsightClientRow[];
  topProducts: MiInsightProductRow[];
  topCategories: MiInsightProductRow[];
  segments: Record<string, number> | null;
  inactiveLoyal: MiInsightInactiveRow[];
  /** true si aucun bloc chiffré affichable (sans inventer). */
  empty: boolean;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function parseKpis(raw: unknown): MiInsightKpis | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const revenue = num(o.revenue);
  const visits = num(o.visits);
  const averageBasket = num(o.averageBasket);
  // Canonique CRM : clientsServed ; compat tests / payloads legacy : activeClients
  const activeClients = num(o.clientsServed) ?? num(o.activeClients);
  if (revenue === null || visits === null || averageBasket === null || activeClients === null) {
    return null;
  }
  return {
    revenue,
    visits,
    averageBasket,
    activeClients,
    previousRevenue: num(o.previousRevenue),
    previousVisits: num(o.previousVisits),
    previousAverageBasket: num(o.previousAverageBasket),
    previousClientsServed: num(o.previousClientsServed),
    newClients: num(o.newClients),
    previousNewClients: num(o.previousNewClients),
    returningClients: num(o.returningClients),
    frequency: num(o.frequency),
  };
}

function parseTrendPoint(raw: unknown): MiInsightTrendPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const current = num(o.current);
  const previous = num(o.previous);
  if (current === null || previous === null) return null;
  const changePct = num(o.changePct);
  return {
    current,
    previous,
    changePct,
    significant: Boolean(o.significant),
  };
}

function parseTrends(raw: unknown): MiInsightTrends | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const revenue = parseTrendPoint(o.revenue);
  const visits = parseTrendPoint(o.visits);
  const clientsServed = parseTrendPoint(o.clientsServed);
  const averageBasket = parseTrendPoint(o.averageBasket);
  const newClients = parseTrendPoint(o.newClients);
  const comparisonNote = str(o.comparisonNote);
  if (!revenue || !visits || !clientsServed || !averageBasket || !newClients || !comparisonNote) {
    return null;
  }
  return { revenue, visits, clientsServed, averageBasket, newClients, comparisonNote };
}

function parseOpportunities(raw: unknown): MiInsightOpportunity[] {
  if (!Array.isArray(raw)) return [];
  const out: MiInsightOpportunity[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id = str(o.id);
    const ruleId = str(o.ruleId);
    const priority = o.priority;
    const detectionRule = str(o.detectionRule);
    const suggestedAction = str(o.suggestedAction);
    if (
      !id ||
      !ruleId ||
      (priority !== 'high' && priority !== 'medium' && priority !== 'low') ||
      !detectionRule ||
      !suggestedAction
    ) {
      continue;
    }
    const periodRaw = o.period && typeof o.period === 'object' ? (o.period as Record<string, unknown>) : {};
    const facts = Array.isArray(o.facts)
      ? o.facts.filter((x): x is string => typeof x === 'string')
      : [];
    const limits = Array.isArray(o.limits)
      ? o.limits.filter((x): x is string => typeof x === 'string')
      : [];
    out.push({
      id,
      ruleId,
      priority,
      facts,
      detectionRule,
      period: {
        code: str(periodRaw.code) ?? '',
        label: str(periodRaw.label) ?? '',
        from: str(periodRaw.from) ?? '',
        to: str(periodRaw.to) ?? '',
      },
      limits,
      suggestedAction,
    });
  }
  return out;
}

function parseTopClients(raw: unknown): MiInsightClientRow[] {
  if (!Array.isArray(raw)) return [];
  const out: MiInsightClientRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const clientId = str(o.clientId);
    const displayName = str(o.displayName);
    const spent = num(o.spent);
    const visits = num(o.visits);
    const averageBasket = num(o.averageBasket);
    if (!clientId || !displayName || spent === null || visits === null || averageBasket === null) continue;
    out.push({
      clientId,
      displayName,
      phoneMasked: str(o.phoneMasked) ?? '***',
      spent,
      visits,
      averageBasket,
      favoriteProduct: str(o.favoriteProduct),
    });
  }
  return out;
}

function parseProducts(raw: unknown): MiInsightProductRow[] {
  if (!Array.isArray(raw)) return [];
  const out: MiInsightProductRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const name = str(o.name);
    const quantity = num(o.quantity);
    const revenue = num(o.revenue);
    const clients = num(o.clients);
    if (!name || quantity === null || revenue === null || clients === null) continue;
    out.push({ name, quantity, revenue, clients });
  }
  return out;
}

function parseInactive(raw: unknown): MiInsightInactiveRow[] {
  if (!Array.isArray(raw)) return [];
  const out: MiInsightInactiveRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const clientId = str(o.clientId);
    const displayName = str(o.displayName);
    const visitCount = num(o.visitCount);
    const totalSpent = num(o.totalSpent);
    if (!clientId || !displayName || visitCount === null || totalSpent === null) continue;
    out.push({
      clientId,
      displayName,
      phoneMasked: str(o.phoneMasked) ?? '***',
      segment: str(o.segment) ?? 'inactive',
      visitCount,
      lastVisitAt: str(o.lastVisitAt),
      totalSpent,
    });
  }
  return out;
}

function parseSegments(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = num(v);
    if (n !== null) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

function parseCustomerIntelligence(raw: unknown): MiInsightCustomerIntelligence | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const metricsRaw = Array.isArray(o.metrics) ? o.metrics : [];
  const metrics: MiInsightCustomerMetric[] = [];
  for (const row of metricsRaw) {
    if (!row || typeof row !== 'object') continue;
    const m = row as Record<string, unknown>;
    const id = str(m.id);
    const label = str(m.label);
    if (!id || !label) continue;
    metrics.push({
      id,
      label,
      value: num(m.value),
      unit: str(m.unit) ?? 'count',
      source: str(m.source) ?? '',
      periodScope: str(m.periodScope) ?? '',
      inclusionRules: str(m.inclusionRules) ?? '',
      limits: Array.isArray(m.limits) ? m.limits.filter((x): x is string => typeof x === 'string') : [],
      zeroMeans: str(m.zeroMeans) ?? '',
    });
  }
  const segObj =
    o.segments && typeof o.segments === 'object'
      ? (o.segments as Record<string, unknown>)
      : null;
  const segmentCounts = segObj ? parseSegments(segObj.counts) : null;
  return {
    metrics,
    segmentCounts,
    evolutionAvailable: Boolean(segObj?.evolutionAvailable),
    evolutionNote: segObj ? str(segObj.evolutionNote) : null,
    medianRecencyDays: num(o.medianRecencyDays),
  };
}

function parseRetentionStrategies(raw: unknown): MiInsightRetentionStrategy[] {
  if (!Array.isArray(raw)) return [];
  const out: MiInsightRetentionStrategy[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id = str(o.id);
    const ruleId = str(o.ruleId);
    const priority = o.priority;
    const confidence = o.confidence;
    const segmentKey = str(o.segmentKey);
    const headcount = num(o.headcount);
    const selectionCriteria = str(o.selectionCriteria);
    const marketingObjective = str(o.marketingObjective);
    const suggestedAction = str(o.suggestedAction);
    if (
      !id ||
      !ruleId ||
      !segmentKey ||
      headcount === null ||
      !selectionCriteria ||
      !marketingObjective ||
      !suggestedAction ||
      (priority !== 'high' && priority !== 'medium' && priority !== 'low') ||
      (confidence !== 'low' && confidence !== 'medium')
    ) {
      continue;
    }
    const periodRaw = o.period && typeof o.period === 'object' ? (o.period as Record<string, unknown>) : {};
    out.push({
      id,
      ruleId,
      priority,
      segmentKey,
      headcount,
      selectionCriteria,
      facts: Array.isArray(o.facts) ? o.facts.filter((x): x is string => typeof x === 'string') : [],
      period: {
        code: str(periodRaw.code) ?? '',
        label: str(periodRaw.label) ?? '',
        from: str(periodRaw.from) ?? '',
        to: str(periodRaw.to) ?? '',
      },
      marketingObjective,
      suggestedAction,
      limits: Array.isArray(o.limits) ? o.limits.filter((x): x is string => typeof x === 'string') : [],
      confidence,
    });
  }
  return out;
}

export function formatMoney(amount: number, currency: string, locale: 'fr' | 'en'): string {
  const loc = locale === 'en' ? 'en-US' : 'fr-FR';
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: currency === 'XOF' ? 'XOF' : currency,
      maximumFractionDigits: currency === 'XOF' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString(loc)} ${currency}`;
  }
}

export function formatChangePct(pct: number | null, locale: 'fr' | 'en'): string {
  if (pct === null) return locale === 'en' ? 'n/a' : 'n/d';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct} %`;
}

/**
 * Transforme `insights` API en structure d’affichage.
 * Si dataQuality=insufficient → aucun KPI / liste n’est exposé comme « stats fiables ».
 */
export function formatMiInsights(
  insights: Record<string, unknown> | null | undefined,
  dataQuality: string | null | undefined
): MiFormattedInsights {
  const dq =
    dataQuality === 'ok' || dataQuality === 'partial' || dataQuality === 'insufficient'
      ? dataQuality
      : 'unknown';

  const limits = Array.isArray(insights?.limits)
    ? insights!.limits.filter((x): x is string => typeof x === 'string')
    : [];

  const currency = str(insights?.currency) ?? 'XOF';
  const restaurantName = str(insights?.restaurantName);
  const clientCount = num(insights?.clientCount);

  const customerIntelligence = parseCustomerIntelligence(insights?.customerIntelligence);
  const retentionStrategies = parseRetentionStrategies(insights?.retentionStrategies);

  if (dq === 'insufficient') {
    return {
      dataQuality: dq,
      limits,
      currency,
      restaurantName,
      clientCount,
      kpis: null,
      trends: null,
      opportunities: [],
      customerIntelligence,
      retentionStrategies,
      topClients: [],
      topProducts: [],
      topCategories: [],
      segments: customerIntelligence?.segmentCounts ?? null,
      inactiveLoyal: [],
      empty: retentionStrategies.length === 0 && !customerIntelligence,
    };
  }

  const kpis = parseKpis(insights?.kpis);
  const trends = parseTrends(insights?.trends);
  const opportunities = parseOpportunities(insights?.opportunities);
  const topClients = parseTopClients(insights?.topClients);
  const topProducts = parseProducts(insights?.topProducts);
  const topCategories = parseProducts(insights?.topCategories);
  const segments = parseSegments(insights?.segments) ?? customerIntelligence?.segmentCounts ?? null;
  const inactiveLoyal = parseInactive(insights?.inactiveLoyal);

  const empty =
    !kpis &&
    !trends &&
    opportunities.length === 0 &&
    retentionStrategies.length === 0 &&
    !customerIntelligence &&
    topClients.length === 0 &&
    topProducts.length === 0 &&
    topCategories.length === 0 &&
    !segments &&
    inactiveLoyal.length === 0;

  return {
    dataQuality: dq,
    limits,
    currency,
    restaurantName,
    clientCount,
    kpis,
    trends,
    opportunities,
    customerIntelligence,
    retentionStrategies,
    topClients,
    topProducts,
    topCategories,
    segments,
    inactiveLoyal,
    empty,
  };
}
