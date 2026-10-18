/**
 * Présentation structurée des insights MI — uniquement à partir du payload API.
 * Aucun chiffre de démonstration.
 */

export interface MiInsightKpis {
  revenue: number;
  visits: number;
  averageBasket: number;
  activeClients: number;
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

export interface MiFormattedInsights {
  dataQuality: 'ok' | 'partial' | 'insufficient' | 'unknown';
  limits: string[];
  currency: string;
  restaurantName: string | null;
  clientCount: number | null;
  kpis: MiInsightKpis | null;
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
  const activeClients = num(o.activeClients);
  if (revenue === null || visits === null || averageBasket === null || activeClients === null) {
    return null;
  }
  return { revenue, visits, averageBasket, activeClients };
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

  if (dq === 'insufficient') {
    return {
      dataQuality: dq,
      limits,
      currency,
      restaurantName,
      clientCount,
      kpis: null,
      topClients: [],
      topProducts: [],
      topCategories: [],
      segments: null,
      inactiveLoyal: [],
      empty: true,
    };
  }

  const kpis = parseKpis(insights?.kpis);
  const topClients = parseTopClients(insights?.topClients);
  const topProducts = parseProducts(insights?.topProducts);
  const topCategories = parseProducts(insights?.topCategories);
  const segments = parseSegments(insights?.segments);
  const inactiveLoyal = parseInactive(insights?.inactiveLoyal);

  const empty =
    !kpis &&
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
    topClients,
    topProducts,
    topCategories,
    segments,
    inactiveLoyal,
    empty,
  };
}
