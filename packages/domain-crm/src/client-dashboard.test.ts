import { describe, expect, it } from 'vitest';
import {
  computeClientDashboard,
  computeClientProfile,
  dashboardWindowStart,
  localDay,
  parseDashboardPeriod,
  percentChange,
  periodRange,
  type DashboardClient,
  type DashboardItem,
  type DashboardVisit,
} from './client-dashboard';

// Mercredi 14 octobre 2026, midi à Dakar (UTC).
const NOW = new Date('2026-10-14T12:00:00Z');

function client(id: string, fullName: string, totalSpent: number, createdAt = '2026-01-10T10:00:00Z'): DashboardClient {
  return {
    id,
    full_name: fullName,
    phone: `+22170000000${id}`,
    created_at: createdAt,
    total_spent: totalSpent,
    visit_count: 1,
    last_visit_at: '2026-10-13T12:00:00Z',
  };
}

function visit(
  id: string,
  clientId: string,
  day: string,
  amount: number,
  status = 'paid',
  refunded = 0
): DashboardVisit {
  return { id, client_id: clientId, visited_at: `${day}T12:00:00Z`, amount, status, refunded_amount: refunded };
}

function item(visitId: string, name: string, quantity: number, lineTotal: number, category = 'Plats'): DashboardItem {
  return { visit_id: visitId, name, category_name: category, quantity, line_total: lineTotal };
}

const clients = [
  client('a', 'Awa', 23_000),
  client('b', 'Bara', 27_000),
  client('c', 'Coumba', 3_000, '2026-10-14T09:00:00Z'),
  client('d', 'Diop', 5_000, '2026-09-03T09:00:00Z'),
  client('z', 'Zeyna', 0),
];

const visits = [
  visit('a1', 'a', '2026-10-12', 10_000),
  visit('a2', 'a', '2026-10-13', 5_000),
  visit('b1', 'b', '2026-10-13', 20_000),
  visit('c1', 'c', '2026-10-14', 3_000),
  visit('d1', 'd', '2026-10-02', 1_000),
  visit('x1', 'supprime', '2026-10-13', 99_999),
  visit('a0', 'a', '2026-09-10', 8_000),
  visit('d0', 'd', '2026-09-05', 4_000),
  visit('b0', 'b', '2026-10-06', 7_000),
];

const items = [
  item('a1', 'Thieboudienne', 2, 10_000),
  item('a2', 'Yassa poulet', 1, 5_000),
  item('b1', 'Thieboudienne', 1, 5_000),
  item('b1', 'Bissap', 3, 3_000, 'Boissons'),
  item('a0', 'Thieboudienne', 1, 5_000),
];

function dashboard(period: 'semaine' | 'mois' | '3mois' | 'annee') {
  return computeClientDashboard({ clients, visits, items, period, now: NOW, timezone: 'Africa/Dakar' });
}

describe('periodRange', () => {
  it('semaine : du lundi à aujourd’hui, sept jours, comparée à la semaine précédente', () => {
    const range = periodRange('semaine', '2026-10-14');
    expect(range).toMatchObject({ start: '2026-10-12', end: '2026-10-14', previous: { start: '2026-10-05', end: '2026-10-07' } });
    expect(range.buckets.map((bucket) => bucket.label)).toEqual(['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']);
    expect(range.buckets[6].start).toBe('2026-10-18');
  });

  it('mois : un point par jour, comparaison ramenée à la fin du mois précédent', () => {
    const range = periodRange('mois', '2026-03-31');
    expect(range).toMatchObject({ start: '2026-03-01', previous: { start: '2026-02-01', end: '2026-02-28' } });
    expect(range.buckets).toHaveLength(31);
  });

  it('3 mois : semaines commençant le lundi, depuis le 1er du mois il y a deux mois', () => {
    const range = periodRange('3mois', '2026-10-14');
    expect(range).toMatchObject({ start: '2026-08-01', previous: { start: '2026-05-01', end: '2026-07-14' } });
    expect(range.buckets[0]).toMatchObject({ key: '2026-07-27', label: '27 juil.', end: '2026-08-02' });
    expect(range.buckets.at(-1)?.key).toBe('2026-10-12');
  });

  it('année : douze mois de janvier à décembre', () => {
    const range = periodRange('annee', '2026-10-14');
    expect(range).toMatchObject({ start: '2026-01-01', previous: { start: '2025-01-01', end: '2025-10-14' } });
    expect(range.buckets).toHaveLength(12);
    expect(range.buckets[1]).toMatchObject({ key: '2026-02', start: '2026-02-01', end: '2026-02-28' });
  });
});

describe('outils', () => {
  it('ramène un instant au jour local de l’établissement', () => {
    expect(localDay('2026-10-11T23:30:00Z', 'Africa/Dakar')).toBe('2026-10-11');
    expect(localDay('2026-10-11T23:30:00Z', 'Europe/Paris')).toBe('2026-10-12');
    expect(localDay('2026-10-11T23:30:00Z', 'Fuseau/Inconnu')).toBe('2026-10-11');
    expect(localDay('pas une date', 'Africa/Dakar')).toBeNull();
  });

  it('lit la période depuis l’URL avec « mois » par défaut', () => {
    expect(parseDashboardPeriod('semaine')).toBe('semaine');
    expect(parseDashboardPeriod('n-importe')).toBe('mois');
    expect(parseDashboardPeriod(undefined)).toBe('mois');
  });

  it('calcule une variation seulement avec une base de comparaison', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });

  it('lit assez d’historique pour la période, la semaine, le mois précédent et douze mois', () => {
    expect(dashboardWindowStart('semaine', '2026-10-14')).toBe('2025-10-14');
    expect(dashboardWindowStart('annee', '2026-10-14')).toBe('2025-01-01');
  });
});

describe('computeClientDashboard', () => {
  it('classe le top 3 de la semaine calendaire, sans clients supprimés', () => {
    const { week } = dashboard('mois');
    expect(week.range).toEqual({ start: '2026-10-12', end: '2026-10-14' });
    expect(week.podium.map((row) => [row.name, row.spent, row.visits])).toEqual([
      ['Bara', 20_000, 1],
      ['Awa', 15_000, 2],
      ['Coumba', 3_000, 1],
    ]);
    expect(week.podium[1]).toMatchObject({ averageBasket: 7_500, favoriteProduct: 'Thieboudienne' });
  });

  it('désigne le plus gros et le plus petit dépensier du mois parmi les clients venus', () => {
    const { month } = dashboard('semaine');
    expect(month.buyers).toBe(4);
    expect(month.top).toMatchObject({ name: 'Bara', spent: 27_000, visits: 2, previousSpent: 0 });
    expect(month.lowest).toMatchObject({ name: 'Diop', spent: 1_000, previousSpent: 4_000 });
  });

  it('ne désigne pas de plus petit dépensier avec un seul client venu', () => {
    const result = computeClientDashboard({
      clients,
      visits: [visit('a1', 'a', '2026-10-12', 10_000)],
      items: [],
      period: 'mois',
      now: NOW,
      timezone: 'Africa/Dakar',
    });
    expect(result.month.top?.name).toBe('Awa');
    expect(result.month.lowest).toBeNull();
  });

  it('calcule les indicateurs du mois et ceux de la même durée le mois précédent', () => {
    const { kpis } = dashboard('mois');
    expect(kpis).toMatchObject({
      revenue: 46_000,
      previousRevenue: 12_000,
      clientsServed: 4,
      previousClientsServed: 2,
      visits: 6,
      averageBasket: 46_000 / 6,
      previousAverageBasket: 6_000,
      newClients: 1,
      previousNewClients: 1,
      returningClients: 2,
      frequency: 1.5,
    });
  });

  it('ignore les commandes annulées, remboursées ou en attente, et déduit les remboursements partiels', () => {
    const withStatuses = [
      ...visits,
      visit('a3', 'a', '2026-10-13', 40_000, 'cancelled'),
      visit('a4', 'a', '2026-10-13', 30_000, 'refunded', 30_000),
      visit('b2', 'b', '2026-10-13', 50_000, 'pending'),
      visit('c2', 'c', '2026-10-14', 10_000, 'partially_refunded', 4_000),
    ];
    const withItems = [...items, item('a3', 'Langouste', 4, 40_000)];
    const result = computeClientDashboard({ clients, visits: withStatuses, items: withItems, period: 'mois', now: NOW, timezone: 'Africa/Dakar' });
    expect(result.kpis.revenue).toBe(46_000 + 6_000);
    expect(result.kpis.visits).toBe(7);
    expect(result.week.podium.map((row) => [row.name, row.spent])).toEqual([
      ['Bara', 20_000],
      ['Awa', 15_000],
      ['Coumba', 9_000],
    ]);
    expect(result.topProducts.map((product) => product.name)).not.toContain('Langouste');
  });

  it('compare la semaine à la semaine précédente au même jour', () => {
    const { kpis, series } = dashboard('semaine');
    expect(kpis.revenue).toBe(38_000);
    expect(kpis.previousRevenue).toBe(7_000);
    expect(series.map((point) => point.revenue)).toEqual([10_000, 25_000, 3_000, 0, 0, 0, 0]);
    expect(series.map((point) => point.future)).toEqual([false, false, false, true, true, true, true]);
  });

  it('classe les plats et les catégories les plus commandés sur la période', () => {
    const { topProducts, topCategories } = dashboard('mois');
    expect(topProducts[0]).toEqual({ name: 'Thieboudienne', quantity: 3, revenue: 15_000, clients: 2 });
    expect(topProducts.map((product) => product.name)).toEqual(['Thieboudienne', 'Bissap', 'Yassa poulet']);
    expect(topCategories.map((category) => [category.name, category.quantity])).toEqual([
      ['Plats', 4],
      ['Boissons', 3],
    ]);
  });

  it('enrichit chaque fiche : dépense du mois, panier moyen sur douze mois, plat préféré et rang', () => {
    const { perClient } = dashboard('mois');
    expect(perClient.a).toEqual({ monthSpent: 15_000, averageBasket: 23_000 / 3, favoriteProduct: 'Thieboudienne', rank: 2 });
    expect(perClient.b.rank).toBe(1);
    expect(perClient.z).toEqual({ monthSpent: 0, averageBasket: 0, favoriteProduct: null, rank: null });
  });

  it('trace douze mois de dépenses d’un client et ses plats préférés', () => {
    const own = visits
      .filter((row) => row.client_id === 'a')
      .map((row) => ({ ...row, items: items.filter((line) => line.visit_id === row.id) }));
    own.push({ ...visit('old', 'a', '2025-09-30', 50_000), items: [] });
    own.push({ ...visit('void', 'a', '2026-10-13', 70_000, 'cancelled'), items: [item('void', 'Langouste', 5, 70_000)] });
    const profile = computeClientProfile({ visits: own, now: NOW, timezone: 'Africa/Dakar' });
    expect(profile.months).toHaveLength(12);
    expect(profile.months[0]).toMatchObject({ key: '2025-11', label: 'nov. 25', spent: 0 });
    expect(profile.months[2].label).toBe('janv. 26');
    expect(profile.months.at(-2)).toMatchObject({ key: '2026-09', spent: 8_000, visits: 1 });
    expect(profile.months.at(-1)).toMatchObject({ key: '2026-10', spent: 15_000, visits: 2 });
    expect(profile.topProducts.map((product) => [product.name, product.quantity])).toEqual([
      ['Thieboudienne', 3],
      ['Yassa poulet', 1],
    ]);
  });

  it('compte les passages selon le jour local du restaurant', () => {
    const late = [visit('late', 'a', '2026-10-11', 2_000)];
    late[0].visited_at = '2026-10-11T23:30:00Z';
    const dakar = computeClientDashboard({ clients, visits: late, items: [], period: 'semaine', now: NOW, timezone: 'Africa/Dakar' });
    const paris = computeClientDashboard({ clients, visits: late, items: [], period: 'semaine', now: NOW, timezone: 'Europe/Paris' });
    expect(dakar.kpis.revenue).toBe(0);
    expect(paris.kpis.revenue).toBe(2_000);
  });
});
