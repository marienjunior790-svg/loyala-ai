import { describe, expect, it } from 'vitest';
import {
  buildMiOpportunities,
  buildMiTrends,
  MI_TREND_MIN_COMBINED_VISITS,
  MI_TREND_SIGNIFICANT_PCT,
} from './mi-opportunities';
import type { MiInactiveClient, MiPeriodMeta } from './mi-tools';
import type { ClientDashboard } from './client-dashboard';

const period: MiPeriodMeta = {
  code: 'mois',
  label: 'Mois',
  from: '2026-10-01',
  to: '2026-10-18',
  definition: 'Du 1er du mois…',
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

const inactive: MiInactiveClient = {
  clientId: 'c1',
  displayName: 'Awa',
  phoneMasked: '***01',
  segment: 'inactive',
  visitCount: 5,
  lastVisitAt: '2026-09-01T00:00:00Z',
  totalSpent: 80_000,
};

describe('buildMiTrends', () => {
  it('retourne null sans KPIs', () => {
    expect(buildMiTrends(null, period)).toBeNull();
  });

  it('calcule changePct et significant avec volume suffisant', () => {
    const trends = buildMiTrends(
      kpis({
        revenue: 80_000,
        previousRevenue: 100_000,
        visits: 10,
        previousVisits: 10,
        clientsServed: 8,
        previousClientsServed: 10,
        averageBasket: 8_000,
        previousAverageBasket: 10_000,
        newClients: 1,
        previousNewClients: 4,
      }),
      period
    );
    expect(trends).not.toBeNull();
    expect(trends!.revenue.changePct).toBe(-20);
    expect(trends!.revenue.significant).toBe(true);
    expect(trends!.comparisonNote).toContain('2026-10-01');
  });

  it('n’affiche pas significant si volume insuffisant', () => {
    const trends = buildMiTrends(
      kpis({
        revenue: 1_000,
        previousRevenue: 10_000,
        visits: 1,
        previousVisits: 1,
      }),
      period
    );
    expect(trends!.revenue.changePct).toBe(-90);
    expect(trends!.revenue.significant).toBe(false);
    expect(1 + 1).toBeLessThan(MI_TREND_MIN_COMBINED_VISITS);
  });
});

describe('buildMiOpportunities', () => {
  it('vide si dataQuality insufficient', () => {
    expect(
      buildMiOpportunities({
        period,
        dataQuality: 'insufficient',
        kpis: kpis({ revenue: 1, previousRevenue: 100, visits: 20, previousVisits: 20 }),
        segments: { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 10 },
        inactiveLoyal: [inactive],
        currency: 'XOF',
      })
    ).toEqual([]);
  });

  it('détecte baisse CA significative avec volume', () => {
    const ops = buildMiOpportunities({
      period,
      dataQuality: 'ok',
      kpis: kpis({
        revenue: 50_000,
        previousRevenue: 100_000,
        visits: 10,
        previousVisits: 12,
      }),
      segments: { new: 1, regular: 2, vip: 0, inactive: 0, at_risk: 0 },
      inactiveLoyal: [],
      currency: 'XOF',
    });
    const drop = ops.find((o) => o.ruleId === 'revenue_drop_significant');
    expect(drop).toBeDefined();
    expect(drop!.detectionRule).toContain(String(MI_TREND_SIGNIFICANT_PCT));
    expect(drop!.facts.some((f) => f.includes('Variation'))).toBe(true);
    expect(drop!.limits.length).toBeGreaterThan(0);
    expect(drop!.suggestedAction.length).toBeGreaterThan(10);
  });

  it('n’alerte pas une baisse CA sur volume trop faible', () => {
    const ops = buildMiOpportunities({
      period,
      dataQuality: 'ok',
      kpis: kpis({
        revenue: 1_000,
        previousRevenue: 10_000,
        visits: 1,
        previousVisits: 1,
      }),
      segments: { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 0 },
      inactiveLoyal: [],
      currency: 'XOF',
    });
    expect(ops.find((o) => o.ruleId === 'revenue_drop_significant')).toBeUndefined();
  });

  it('détecte reconquête fidèles inactifs', () => {
    const ops = buildMiOpportunities({
      period,
      dataQuality: 'partial',
      kpis: kpis({ revenue: 10_000, previousRevenue: 10_000, visits: 5, previousVisits: 5 }),
      segments: { new: 0, regular: 1, vip: 0, inactive: 2, at_risk: 1 },
      inactiveLoyal: [inactive, { ...inactive, clientId: 'c2', totalSpent: 150_000 }],
      currency: 'XOF',
    });
    const rec = ops.find((o) => o.ruleId === 'inactive_loyal_reconquest');
    expect(rec).toBeDefined();
    expect(rec!.facts.some((f) => f.includes('2 client'))).toBe(true);
  });

  it('détecte segment at_risk assez large', () => {
    const ops = buildMiOpportunities({
      period,
      dataQuality: 'ok',
      kpis: kpis({ visits: 5, previousVisits: 5, revenue: 5_000, previousRevenue: 5_000 }),
      segments: { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 5 },
      inactiveLoyal: [],
      currency: 'XOF',
    });
    expect(ops.find((o) => o.ruleId === 'at_risk_segment_size')).toBeDefined();
  });

  it('classe high avant low', () => {
    const ops = buildMiOpportunities({
      period,
      dataQuality: 'ok',
      kpis: kpis({
        revenue: 40_000,
        previousRevenue: 100_000,
        visits: 15,
        previousVisits: 15,
        newClients: 0,
        previousNewClients: 5,
      }),
      segments: { new: 0, regular: 0, vip: 0, inactive: 0, at_risk: 12 },
      inactiveLoyal: Array.from({ length: 12 }, (_, i) => ({
        ...inactive,
        clientId: `c${i}`,
        totalSpent: 50_000,
      })),
      currency: 'XOF',
    });
    expect(ops.length).toBeGreaterThan(1);
    for (let i = 1; i < ops.length; i++) {
      expect(ops[i - 1]!.rankScore).toBeGreaterThanOrEqual(ops[i]!.rankScore);
    }
  });
});
