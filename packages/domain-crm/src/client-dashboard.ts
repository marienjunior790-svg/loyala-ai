import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client } from './clients';
import { countsAsRevenue, orderNetAmount, REVENUE_ORDER_STATUSES } from './orders';
import { computeClientSegment, type ClientSegment } from './segments';

/**
 * Tableau de bord clients : qui consomme, combien et quoi, sur une période.
 * Le calcul est pur ; seule `getClientDashboard` lit la base.
 * Toutes les dates sont ramenées au jour local de l'établissement (fuseau de l'organisation).
 */

export const DASHBOARD_PERIODS = ['semaine', 'mois', '3mois', 'annee'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  semaine: 'Semaine',
  mois: 'Mois',
  '3mois': '3 mois',
  annee: 'Année',
};

export function parseDashboardPeriod(value: unknown): DashboardPeriod {
  return DASHBOARD_PERIODS.find((period) => period === value) ?? 'mois';
}

/** Une commande : seules les commandes payées (ou remboursées en partie) comptent, à leur montant net. */
export interface DashboardVisit {
  id: string;
  client_id: string;
  visited_at: string;
  amount: number | string | null;
  status?: string | null;
  refunded_amount?: number | string | null;
}

export interface DashboardItem {
  visit_id: string;
  name: string;
  category_name: string | null;
  quantity: number | string;
  line_total: number | string;
}

export type DashboardClient = Pick<
  Client,
  'id' | 'full_name' | 'phone' | 'created_at' | 'total_spent' | 'visit_count' | 'last_visit_at'
>;

// ─── Jours locaux ────────────────────────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** Jour local « AAAA-MM-JJ » d'un instant, dans le fuseau donné. */
export function localDay(instant: string | Date, timezone: string): string | null {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return null;
  return formatterFor(timezone).format(date);
}

function toUtc(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

function fromUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Même jour `months` mois plus tôt ou plus tard, ramené au dernier jour du mois si besoin (31 mars → 28 février). */
function addMonths(day: string, months: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
  target.setUTCDate(Math.min(date, last));
  return fromUtc(target);
}

/** Lundi de la semaine du jour donné. */
function mondayOf(day: string): string {
  const weekday = toUtc(day).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

// ─── Périodes ────────────────────────────────────────────────────────────────

export interface DayRange {
  start: string;
  end: string;
}

export interface DashboardBucket {
  key: string;
  label: string;
  start: string;
  end: string;
}

export interface PeriodRange extends DayRange {
  previous: DayRange;
  buckets: DashboardBucket[];
}

const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function shortDay(day: string) {
  const [, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS[month - 1]}`;
}

/**
 * Période en cours jusqu'à aujourd'hui, et la même durée juste avant pour comparer.
 * Semaine : du lundi ; mois : du 1er ; 3 mois : du 1er du mois il y a deux mois ; année : du 1er janvier.
 */
export function periodRange(period: DashboardPeriod, today: string): PeriodRange {
  if (period === 'semaine') {
    const start = mondayOf(today);
    return {
      start,
      end: today,
      previous: { start: addDays(start, -7), end: addDays(today, -7) },
      buckets: WEEKDAYS.map((label, index) => {
        const day = addDays(start, index);
        return { key: day, label, start: day, end: day };
      }),
    };
  }
  if (period === 'mois') {
    const start = `${today.slice(0, 7)}-01`;
    const [year, month] = today.split('-').map(Number);
    const days = daysInMonth(year, month - 1);
    return {
      start,
      end: today,
      previous: { start: addMonths(start, -1), end: addMonths(today, -1) },
      buckets: Array.from({ length: days }, (_, index) => {
        const day = addDays(start, index);
        return { key: day, label: String(index + 1), start: day, end: day };
      }),
    };
  }
  if (period === '3mois') {
    const start = addMonths(`${today.slice(0, 7)}-01`, -2);
    const buckets: DashboardBucket[] = [];
    for (let monday = mondayOf(start); monday <= today; monday = addDays(monday, 7)) {
      buckets.push({ key: monday, label: shortDay(monday), start: monday, end: addDays(monday, 6) });
    }
    return { start, end: today, previous: { start: addMonths(start, -3), end: addMonths(today, -3) }, buckets };
  }
  const start = `${today.slice(0, 4)}-01-01`;
  return {
    start,
    end: today,
    previous: { start: addMonths(start, -12), end: addMonths(today, -12) },
    buckets: MONTHS.map((label, index) => {
      const first = `${today.slice(0, 4)}-${String(index + 1).padStart(2, '0')}-01`;
      return { key: first.slice(0, 7), label, start: first, end: addDays(addMonths(first, 1), -1) };
    }),
  };
}

// ─── Calcul ──────────────────────────────────────────────────────────────────

export interface ClientRank {
  clientId: string;
  name: string;
  phone: string;
  spent: number;
  visits: number;
  averageBasket: number;
  favoriteProduct: string | null;
}

export interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
  clients: number;
}

export interface ClientFileStats {
  monthSpent: number;
  averageBasket: number;
  favoriteProduct: string | null;
  /** Rang par dépense totale depuis toujours (1 = plus gros client), null sans dépense. */
  rank: number | null;
}

export interface ClientDashboard {
  period: DashboardPeriod;
  today: string;
  range: PeriodRange;
  kpis: {
    revenue: number;
    previousRevenue: number;
    clientsServed: number;
    previousClientsServed: number;
    visits: number;
    previousVisits: number;
    averageBasket: number;
    previousAverageBasket: number;
    newClients: number;
    previousNewClients: number;
    returningClients: number;
    /** Visites par client venu sur la période. */
    frequency: number;
  };
  series: { key: string; label: string; revenue: number; visits: number; future: boolean }[];
  ranking: ClientRank[];
  week: { range: DayRange; podium: ClientRank[] };
  month: {
    range: DayRange;
    buyers: number;
    top: (ClientRank & { previousSpent: number }) | null;
    lowest: (ClientRank & { previousSpent: number }) | null;
  };
  topProducts: ProductStat[];
  topCategories: ProductStat[];
  segments: Record<ClientSegment, number>;
  perClient: Record<string, ClientFileStats>;
}

function amountOf(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

type Entry = { clientId: string; day: string; amount: number; items: DashboardItem[] };

function inRange(day: string, range: DayRange) {
  return day >= range.start && day <= range.end;
}

function favorite(items: DashboardItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.name, (counts.get(item.name) ?? 0) + amountOf(item.quantity));
  let best: string | null = null;
  let bestQuantity = 0;
  for (const [name, quantity] of counts) {
    if (quantity > bestQuantity) {
      best = name;
      bestQuantity = quantity;
    }
  }
  return best;
}

function rankClients(entries: Entry[], range: DayRange, clients: Map<string, DashboardClient>): ClientRank[] {
  const byClient = new Map<string, { spent: number; visits: number; paid: number; items: DashboardItem[] }>();
  for (const entry of entries) {
    if (!inRange(entry.day, range)) continue;
    const stats = byClient.get(entry.clientId) ?? { spent: 0, visits: 0, paid: 0, items: [] };
    stats.spent += entry.amount;
    stats.visits += 1;
    if (entry.amount > 0) stats.paid += 1;
    stats.items.push(...entry.items);
    byClient.set(entry.clientId, stats);
  }
  return [...byClient.entries()]
    .filter(([, stats]) => stats.spent > 0)
    .map(([clientId, stats]) => {
      const client = clients.get(clientId);
      return {
        clientId,
        name: client?.full_name ?? 'Client',
        phone: client?.phone ?? '',
        spent: stats.spent,
        visits: stats.visits,
        averageBasket: stats.paid > 0 ? stats.spent / stats.paid : 0,
        favoriteProduct: favorite(stats.items),
      };
    })
    .sort((a, b) => b.spent - a.spent || b.visits - a.visits || a.name.localeCompare(b.name, 'fr'));
}

function summarize(entries: Entry[], range: DayRange) {
  let revenue = 0;
  let visits = 0;
  let paid = 0;
  const clients = new Map<string, number>();
  for (const entry of entries) {
    if (!inRange(entry.day, range)) continue;
    revenue += entry.amount;
    if (entry.amount > 0) paid += 1;
    visits += 1;
    clients.set(entry.clientId, (clients.get(entry.clientId) ?? 0) + 1);
  }
  return {
    revenue,
    visits,
    clientsServed: clients.size,
    averageBasket: paid > 0 ? revenue / paid : 0,
    returningClients: [...clients.values()].filter((count) => count >= 2).length,
  };
}

function productStats(entries: Entry[], range: DayRange, key: (item: DashboardItem) => string | null): ProductStat[] {
  const stats = new Map<string, { quantity: number; revenue: number; clients: Set<string> }>();
  for (const entry of entries) {
    if (!inRange(entry.day, range)) continue;
    for (const item of entry.items) {
      const name = key(item)?.trim();
      if (!name) continue;
      const current = stats.get(name) ?? { quantity: 0, revenue: 0, clients: new Set<string>() };
      current.quantity += amountOf(item.quantity);
      current.revenue += amountOf(item.line_total);
      current.clients.add(entry.clientId);
      stats.set(name, current);
    }
  }
  return [...stats.entries()]
    .map(([name, value]) => ({ name, quantity: value.quantity, revenue: value.revenue, clients: value.clients.size }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 6);
}

/** Premier jour à lire en base pour couvrir la période, sa comparaison, la semaine, le mois et douze mois d'historique. */
export function dashboardWindowStart(period: DashboardPeriod, today: string): string {
  const range = periodRange(period, today);
  const candidates = [range.previous.start, addDays(mondayOf(today), -7), addMonths(`${today.slice(0, 7)}-01`, -1), addDays(today, -365)];
  return candidates.sort()[0];
}

export function computeClientDashboard(input: {
  clients: DashboardClient[];
  visits: DashboardVisit[];
  items: DashboardItem[];
  period: DashboardPeriod;
  now: Date;
  timezone: string;
}): ClientDashboard {
  const today = localDay(input.now, input.timezone) ?? fromUtc(input.now);
  const range = periodRange(input.period, today);
  const clients = new Map(input.clients.map((client) => [client.id, client]));
  const itemsByVisit = new Map<string, DashboardItem[]>();
  for (const item of input.items) {
    const list = itemsByVisit.get(item.visit_id) ?? [];
    list.push(item);
    itemsByVisit.set(item.visit_id, list);
  }

  const entries: Entry[] = [];
  for (const visit of input.visits) {
    if (!clients.has(visit.client_id) || !countsAsRevenue(visit)) continue;
    const day = localDay(visit.visited_at, input.timezone);
    if (!day) continue;
    entries.push({ clientId: visit.client_id, day, amount: orderNetAmount(visit), items: itemsByVisit.get(visit.id) ?? [] });
  }

  const current = summarize(entries, range);
  const previous = summarize(entries, range.previous);
  const createdIn = (window: DayRange) =>
    input.clients.filter((client) => {
      const day = localDay(client.created_at, input.timezone);
      return day !== null && inRange(day, window);
    }).length;

  const series = range.buckets.map((bucket) => {
    const window = { start: bucket.start, end: bucket.end };
    const stats = summarize(entries, window);
    return { key: bucket.key, label: bucket.label, revenue: stats.revenue, visits: stats.visits, future: bucket.start > today };
  });

  const weekRange = { start: mondayOf(today), end: today };
  const monthRange = { start: `${today.slice(0, 7)}-01`, end: today };
  const previousMonth = { start: addMonths(monthRange.start, -1), end: addDays(monthRange.start, -1) };
  const monthRanking = rankClients(entries, monthRange, clients);
  const previousSpent = new Map(rankClients(entries, previousMonth, clients).map((row) => [row.clientId, row.spent]));
  const withPrevious = (row: ClientRank | undefined) => (row ? { ...row, previousSpent: previousSpent.get(row.clientId) ?? 0 } : null);

  const segments: Record<ClientSegment, number> = { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 0 };
  for (const client of input.clients) segments[computeClientSegment(client)] += 1;

  const yearRange = { start: addDays(today, -365), end: today };
  const lastYear = new Map<string, { spent: number; paid: number; items: DashboardItem[] }>();
  for (const entry of entries) {
    if (!inRange(entry.day, yearRange)) continue;
    const stats = lastYear.get(entry.clientId) ?? { spent: 0, paid: 0, items: [] };
    stats.spent += entry.amount;
    if (entry.amount > 0) stats.paid += 1;
    stats.items.push(...entry.items);
    lastYear.set(entry.clientId, stats);
  }
  const monthSpent = new Map(monthRanking.map((row) => [row.clientId, row.spent]));
  const byTotal = input.clients
    .filter((client) => amountOf(client.total_spent) > 0)
    .sort((a, b) => amountOf(b.total_spent) - amountOf(a.total_spent));
  const ranks = new Map(byTotal.map((client, index) => [client.id, index + 1]));
  const perClient: Record<string, ClientFileStats> = {};
  for (const client of input.clients) {
    const stats = lastYear.get(client.id);
    perClient[client.id] = {
      monthSpent: monthSpent.get(client.id) ?? 0,
      averageBasket: stats && stats.paid > 0 ? stats.spent / stats.paid : 0,
      favoriteProduct: stats ? favorite(stats.items) : null,
      rank: ranks.get(client.id) ?? null,
    };
  }

  return {
    period: input.period,
    today,
    range,
    kpis: {
      revenue: current.revenue,
      previousRevenue: previous.revenue,
      clientsServed: current.clientsServed,
      previousClientsServed: previous.clientsServed,
      visits: current.visits,
      previousVisits: previous.visits,
      averageBasket: current.averageBasket,
      previousAverageBasket: previous.averageBasket,
      newClients: createdIn(range),
      previousNewClients: createdIn(range.previous),
      returningClients: current.returningClients,
      frequency: current.clientsServed > 0 ? current.visits / current.clientsServed : 0,
    },
    series,
    ranking: rankClients(entries, range, clients),
    week: { range: weekRange, podium: rankClients(entries, weekRange, clients).slice(0, 3) },
    month: {
      range: monthRange,
      buyers: monthRanking.length,
      top: withPrevious(monthRanking[0]),
      lowest: monthRanking.length > 1 ? withPrevious(monthRanking[monthRanking.length - 1]) : null,
    },
    topProducts: productStats(entries, range, (item) => item.name),
    topCategories: productStats(entries, range, (item) => item.category_name),
    segments,
    perClient,
  };
}

export interface ClientMonthPoint {
  key: string;
  label: string;
  spent: number;
  visits: number;
}

/** Dépense et passages d'un client sur les douze derniers mois (mois en cours inclus), et ses plats préférés. */
export function computeClientProfile(input: {
  visits: (DashboardVisit & { items: DashboardItem[] })[];
  now: Date;
  timezone: string;
}): { months: ClientMonthPoint[]; topProducts: ProductStat[] } {
  const today = localDay(input.now, input.timezone) ?? fromUtc(input.now);
  const firstMonth = addMonths(`${today.slice(0, 7)}-01`, -11);
  const months: ClientMonthPoint[] = Array.from({ length: 12 }, (_, index) => {
    const first = addMonths(firstMonth, index);
    const [year, month] = first.split('-').map(Number);
    const label = month === 1 || index === 0 ? `${MONTHS[month - 1]} ${String(year).slice(2)}` : MONTHS[month - 1];
    return { key: first.slice(0, 7), label, spent: 0, visits: 0 };
  });
  const byKey = new Map(months.map((point) => [point.key, point]));
  const entries: Entry[] = [];
  for (const visit of input.visits) {
    if (!countsAsRevenue(visit)) continue;
    const day = localDay(visit.visited_at, input.timezone);
    if (!day) continue;
    const amount = orderNetAmount(visit);
    entries.push({ clientId: visit.client_id, day, amount, items: visit.items });
    const point = byKey.get(day.slice(0, 7));
    if (!point) continue;
    point.spent += amount;
    point.visits += 1;
  }
  return { months, topProducts: productStats(entries, { start: '0000-01-01', end: '9999-12-31' }, (item) => item.name) };
}

/** Rang du client par dépense totale parmi les clients actifs (1 = plus gros client). */
export async function getClientSpendRank(
  supabase: SupabaseClient,
  organizationId: string,
  totalSpent: number
): Promise<{ rank: number | null; ranked: number }> {
  const [above, ranked] = await Promise.all([
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .gt('total_spent', totalSpent),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .gt('total_spent', 0),
  ]);
  if (above.error) throw new Error(above.error.message);
  if (ranked.error) throw new Error(ranked.error.message);
  return { rank: totalSpent > 0 ? (above.count ?? 0) + 1 : null, ranked: ranked.count ?? 0 };
}

/** Variation en pourcentage, ou null sans base de comparaison. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let index = 0; index < MAX_PAGES; index++) {
    const from = index * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Lit les passages et articles nécessaires, puis calcule le tableau de bord. */
export async function getClientDashboard(
  supabase: SupabaseClient,
  organizationId: string,
  options: { clients: DashboardClient[]; period: DashboardPeriod; timezone: string; now?: Date }
): Promise<ClientDashboard> {
  const now = options.now ?? new Date();
  const today = localDay(now, options.timezone) ?? fromUtc(now);
  // Un jour de marge : le fuseau local peut décaler le début de journée par rapport à UTC.
  const since = `${addDays(dashboardWindowStart(options.period, today), -1)}T00:00:00Z`;

  const visits = await readAll<DashboardVisit>((from, to) =>
    supabase
      .from('client_visits')
      .select('id, client_id, visited_at, amount, status, refunded_amount')
      .eq('organization_id', organizationId)
      .in('status', [...REVENUE_ORDER_STATUSES])
      .gte('visited_at', since)
      .order('visited_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );

  let items: DashboardItem[] = [];
  try {
    items = await readAll<DashboardItem>((from, to) =>
      supabase
        .from('visit_items')
        .select('visit_id, name, category_name, quantity, line_total')
        .eq('organization_id', organizationId)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (!message.includes('visit_items') && !message.includes('does not exist') && !message.includes('schema cache')) throw error;
  }

  return computeClientDashboard({ clients: options.clients, visits, items, period: options.period, now, timezone: options.timezone });
}