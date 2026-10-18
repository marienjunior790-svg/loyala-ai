import { describe, expect, it } from 'vitest';
import {
  computeClientDashboard,
  type DashboardClient,
  type DashboardItem,
  type DashboardVisit,
} from './client-dashboard';
import {
  assessMiDataQuality,
  listInactiveLoyalClients,
  listPopularProductsFromDashboard,
  listTopClientsFromDashboard,
  maskPhone,
  resolveMiPeriod,
  buildMiPeriodMeta,
} from './mi-tools';
import { buildMiTrends } from './mi-opportunities';
import {
  buildMiCustomerIntelligence,
  buildMiRetentionStrategies,
  computeMedianRecencyDays,
} from './mi-customer-intelligence';
import type { Client } from './clients';

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

describe('resolveMiPeriod', () => {
  it('mappe « 30 jours » / mois sur la période canonique mois', () => {
    expect(resolveMiPeriod('30 derniers jours')).toBe('mois');
    expect(resolveMiPeriod('meilleurs clients sur 30 jours')).toBe('mois');
    expect(resolveMiPeriod('mois')).toBe('mois');
  });

  it('reconnaît semaine / 3mois / année', () => {
    expect(resolveMiPeriod('cette semaine')).toBe('semaine');
    expect(resolveMiPeriod('3 mois')).toBe('3mois');
    expect(resolveMiPeriod('année')).toBe('annee');
  });
});

describe('listTopClientsFromDashboard', () => {
  it('reproduit exactement dashboard.ranking pour la période mois', () => {
    const dash = dashboard('mois');
    const top = listTopClientsFromDashboard(dash, 10);

    expect(top.map((c) => c.clientId)).toEqual(dash.ranking.slice(0, 10).map((r) => r.clientId));
    expect(top.map((c) => c.spent)).toEqual(dash.ranking.slice(0, 10).map((r) => r.spent));
    expect(top.map((c) => c.visits)).toEqual(dash.ranking.slice(0, 10).map((r) => r.visits));

    // Ordre attendu sur le mois d’octobre (fixtures client-dashboard.test)
    expect(top[0]?.clientId).toBe('b');
    expect(top[0]?.spent).toBe(27_000);
  });

  it('borne la pagination à MI_TOP_CLIENTS_MAX', () => {
    const dash = dashboard('mois');
    expect(listTopClientsFromDashboard(dash, 999).length).toBeLessThanOrEqual(20);
  });

  it('masque les téléphones', () => {
    const dash = dashboard('mois');
    const top = listTopClientsFromDashboard(dash, 5);
    for (const row of top) {
      expect(row.phoneMasked).toMatch(/^\*\*\*/);
      expect(row.phoneMasked).not.toContain('700000');
    }
  });
});

describe('listPopularProductsFromDashboard', () => {
  it('reprend topProducts du dashboard', () => {
    const dash = dashboard('mois');
    const products = listPopularProductsFromDashboard(dash, 5);
    expect(products).toEqual(dash.topProducts.slice(0, 5));
  });
});

describe('listInactiveLoyalClients', () => {
  it('ne retourne rien si visite insuffisante / actifs', () => {
    const rows: Client[] = [
      {
        id: '1',
        organization_id: 'org',
        full_name: 'Actif',
        phone: '+221770000001',
        email: null,
        segment: 'regular',
        visit_count: 5,
        total_spent: 100_000,
        loyalty_points: 0,
        last_visit_at: '2026-10-13T12:00:00Z',
        date_of_birth: null,
        opt_in_whatsapp: true,
        whatsapp_consent: 'accorde',
        whatsapp_consent_at: null,
        whatsapp_consent_source: null,
        phone_e164: '+221770000001',
        notes: null,
        acquisition_source: null,
        whatsapp_profile_name: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];
    expect(listInactiveLoyalClients(rows, { minVisits: 2 })).toEqual([]);
  });

  it('sélectionne les clients inactive/at_risk avec minVisits', () => {
    const rows: Client[] = [
      {
        id: 'old',
        organization_id: 'org',
        full_name: 'Ancien',
        phone: '+221770000099',
        email: null,
        segment: 'inactive',
        visit_count: 4,
        total_spent: 80_000,
        loyalty_points: 0,
        last_visit_at: '2026-08-01T12:00:00Z',
        date_of_birth: null,
        opt_in_whatsapp: true,
        whatsapp_consent: 'accorde',
        whatsapp_consent_at: null,
        whatsapp_consent_source: null,
        phone_e164: '+221770000099',
        notes: null,
        acquisition_source: null,
        whatsapp_profile_name: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ];
    const out = listInactiveLoyalClients(rows, { minVisits: 2, now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0]?.clientId).toBe('old');
    expect(out[0]?.phoneMasked).toBe(maskPhone('+221770000099'));
  });
});

describe('buildMiPeriodMeta', () => {
  it('expose from/to du range dashboard', () => {
    const dash = dashboard('mois');
    const meta = buildMiPeriodMeta(dash);
    expect(meta.code).toBe('mois');
    expect(meta.from).toBe(dash.range.start);
    expect(meta.to).toBe(dash.range.end);
    expect(meta.definition).toContain('1er');
  });
});

describe('données insuffisantes (fixtures vides)', () => {
  it('ranking vide → listTopClients vide (pas de chiffres inventés)', () => {
    const empty = computeClientDashboard({
      clients: [client('z', 'Zeyna', 0)],
      visits: [],
      items: [],
      period: 'mois',
      now: NOW,
      timezone: 'Africa/Dakar',
    });
    expect(listTopClientsFromDashboard(empty, 10)).toEqual([]);
    expect(listPopularProductsFromDashboard(empty, 10)).toEqual([]);
  });

  it('assessMiDataQuality → insufficient sans inventer de stats', () => {
    expect(
      assessMiDataQuality({
        clientCount: 0,
        rankingLen: 0,
        productsLen: 0,
        hasItemsTable: false,
      })
    ).toEqual({
      dataQuality: 'insufficient',
      limits: ['Aucun client actif dans cette organisation.'],
    });

    const noOrders = assessMiDataQuality({
      clientCount: 3,
      rankingLen: 0,
      productsLen: 0,
      hasItemsTable: false,
    });
    expect(noOrders.dataQuality).toBe('insufficient');
    expect(noOrders.limits.length).toBeGreaterThan(0);
  });
});

describe('parité KPI cockpit ↔ dashboard CRM', () => {
  it('trends.revenue.current === dashboard.kpis.revenue', () => {
    const dash = dashboard('mois');
    const meta = buildMiPeriodMeta(dash);
    const trends = buildMiTrends(dash.kpis, meta);
    expect(trends).not.toBeNull();
    expect(trends!.revenue.current).toBe(dash.kpis.revenue);
    expect(trends!.revenue.previous).toBe(dash.kpis.previousRevenue);
    expect(trends!.visits.current).toBe(dash.kpis.visits);
    expect(trends!.clientsServed.current).toBe(dash.kpis.clientsServed);
    expect(trends!.averageBasket.current).toBe(dash.kpis.averageBasket);
    expect(trends!.newClients.current).toBe(dash.kpis.newClients);
  });

  it('P2 customer intel / retention alignés sur segments + KPIs dashboard', () => {
    const dash = dashboard('mois');
    const meta = buildMiPeriodMeta(dash);
    const top = listTopClientsFromDashboard(dash, 10);
    const intel = buildMiCustomerIntelligence({
      period: meta,
      dataQuality: 'ok',
      kpis: dash.kpis,
      segments: dash.segments,
      clientCount: clients.length,
      medianRecencyDays: computeMedianRecencyDays(clients, NOW),
      currency: 'XOF',
    });
    expect(intel.metrics.find((m) => m.id === 'period_spend')?.value).toBe(dash.kpis.revenue);
    expect(intel.metrics.find((m) => m.id === 'period_new_clients')?.value).toBe(dash.kpis.newClients);
    expect(intel.segments?.counts).toEqual(dash.segments);
    expect(intel.segments?.evolutionAvailable).toBe(false);

    const strategies = buildMiRetentionStrategies({
      period: meta,
      dataQuality: 'ok',
      segments: dash.segments,
      inactiveLoyal: [],
      topClients: top,
      kpis: dash.kpis,
      clientCount: clients.length,
      currency: 'XOF',
    });
    if (top.length > 0) {
      expect(strategies.some((s) => s.ruleId === 'recognize_top_spenders_period')).toBe(true);
    }
  });
});
