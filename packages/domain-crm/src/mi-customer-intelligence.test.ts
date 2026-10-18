import { describe, expect, it } from 'vitest';
import {
  buildMiCustomerIntelligence,
  buildMiRetentionStrategies,
  computeMedianRecencyDays,
} from './mi-customer-intelligence';
import type { MiPeriodMeta } from './mi-tools';
import type { ClientDashboard } from './client-dashboard';

const period: MiPeriodMeta = {
  code: 'mois',
  label: 'Mois',
  from: '2026-10-01',
  to: '2026-10-18',
  definition: 'Du 1er…',
};

function kpis(partial: Partial<ClientDashboard['kpis']>): ClientDashboard['kpis'] {
  return {
    revenue: 0,
    previousRevenue: 0,
    clientsServed: 0,
    previousClientsServed: 0,
    visits: 0,
    previousVisits: 0,
    averageBasket: 0,
    previousAverageBasket: 0,
    newClients: 0,
    previousNewClients: 0,
    returningClients: 0,
    frequency: 0,
    ...partial,
  };
}

describe('computeMedianRecencyDays', () => {
  it('retourne null sans visites', () => {
    expect(computeMedianRecencyDays([{ last_visit_at: null, visit_count: 0 }])).toBeNull();
  });

  it('calcule une médiane en jours', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const med = computeMedianRecencyDays(
      [
        { last_visit_at: '2026-10-17T12:00:00Z', visit_count: 2 },
        { last_visit_at: '2026-10-10T12:00:00Z', visit_count: 1 },
        { last_visit_at: '2026-10-08T12:00:00Z', visit_count: 3 },
      ],
      now
    );
    expect(med).toBe(8);
  });
});

describe('buildMiCustomerIntelligence', () => {
  it('marque les métriques période null si insufficient (≠ zéro inventé)', () => {
    const intel = buildMiCustomerIntelligence({
      period,
      dataQuality: 'insufficient',
      kpis: kpis({ revenue: 0, visits: 0 }),
      segments: { new: 1, regular: 0, vip: 0, inactive: 0, at_risk: 0 },
      clientCount: 1,
      medianRecencyDays: 5,
      currency: 'XOF',
    });
    const spend = intel.metrics.find((m) => m.id === 'period_spend');
    expect(spend?.value).toBeNull();
    expect(intel.medianRecencyDays).toBe(5);
    expect(intel.segments?.evolutionAvailable).toBe(false);
    expect(intel.segments?.evolutionNote).toMatch(/snapshots|migration/i);
  });

  it('expose 0 réel pour newClients quand KPIs ok', () => {
    const intel = buildMiCustomerIntelligence({
      period,
      dataQuality: 'ok',
      kpis: kpis({
        revenue: 50_000,
        visits: 10,
        clientsServed: 4,
        averageBasket: 5_000,
        frequency: 2.5,
        newClients: 0,
        previousNewClients: 3,
        returningClients: 2,
      }),
      segments: { new: 0, regular: 4, vip: 0, inactive: 1, at_risk: 2 },
      clientCount: 7,
      medianRecencyDays: 3,
      currency: 'XOF',
    });
    expect(intel.metrics.find((m) => m.id === 'period_new_clients')?.value).toBe(0);
    expect(intel.metrics.find((m) => m.id === 'period_spend')?.value).toBe(50_000);
    expect(intel.metrics.find((m) => m.id === 'period_returning_clients')?.value).toBe(2);
    expect(intel.segments?.counts.inactive).toBe(1);
  });
});

describe('buildMiRetentionStrategies', () => {
  it('vide sans clients', () => {
    expect(
      buildMiRetentionStrategies({
        period,
        dataQuality: 'ok',
        segments: { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 0 },
        inactiveLoyal: [],
        topClients: [],
        kpis: kpis({}),
        clientCount: 0,
        currency: 'XOF',
      })
    ).toEqual([]);
  });

  it('propose réactivation + VIP + top période sans inventer de ROI', () => {
    const strategies = buildMiRetentionStrategies({
      period,
      dataQuality: 'ok',
      segments: { new: 2, regular: 5, vip: 1, inactive: 4, at_risk: 3 },
      inactiveLoyal: [
        {
          clientId: 'c1',
          displayName: 'Awa',
          phoneMasked: '***01',
          segment: 'inactive',
          visitCount: 5,
          lastVisitAt: '2026-09-01T00:00:00Z',
          totalSpent: 80_000,
        },
      ],
      topClients: [
        {
          clientId: 'b',
          displayName: 'Bara',
          phoneMasked: '***02',
          spent: 27_000,
          visits: 2,
          averageBasket: 13_500,
          favoriteProduct: 'Thieb',
        },
      ],
      kpis: kpis({ newClients: 2, revenue: 40_000, visits: 8 }),
      clientCount: 15,
      currency: 'XOF',
    });
    const ids = strategies.map((s) => s.ruleId);
    expect(ids).toContain('reactivate_inactive');
    expect(ids).toContain('recognize_vip');
    expect(ids).toContain('recognize_top_spenders_period');
    expect(ids).toContain('encourage_second_purchase');
    expect(ids).toContain('thank_regular');
    expect(ids).toContain('nurture_at_risk');
    for (const s of strategies) {
      expect(s.headcount).toBeGreaterThan(0);
      expect(s.confidence === 'low' || s.confidence === 'medium').toBe(true);
      expect(s.suggestedAction.toLowerCase()).not.toMatch(/roi|conversion garantie|%\s*de retour/);
      expect(s.limits.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < strategies.length; i++) {
      expect(strategies[i - 1]!.rankScore).toBeGreaterThanOrEqual(strategies[i]!.rankScore);
    }
  });

  it('sans commandes période : pas de top spenders, mais segments possibles', () => {
    const strategies = buildMiRetentionStrategies({
      period,
      dataQuality: 'insufficient',
      segments: { new: 1, regular: 2, vip: 0, inactive: 2, at_risk: 1 },
      inactiveLoyal: [
        {
          clientId: 'c1',
          displayName: 'Awa',
          phoneMasked: '***',
          segment: 'inactive',
          visitCount: 4,
          lastVisitAt: null,
          totalSpent: 10_000,
        },
      ],
      topClients: [],
      kpis: null,
      clientCount: 6,
      currency: 'XOF',
    });
    expect(strategies.find((s) => s.ruleId === 'recognize_top_spenders_period')).toBeUndefined();
    expect(strategies.find((s) => s.ruleId === 'reactivate_inactive')).toBeDefined();
  });
});
