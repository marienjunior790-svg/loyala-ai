/**
 * P2.3 — Bridge CRM → Bomaye + briefing REGLE-DEC-01 (part livraison).
 */
import { describe, expect, it } from 'vitest';
import { deriveBomayeSignalsFromCrm } from './knowledge/bomaye-crm-bridge';
import { evaluateBomayeAdvisor } from './knowledge/bomaye-advisor';
import { buildMiProactiveBriefing, type MiBriefingSource } from './mi-proactive-briefing';
import type { MiOrgInsights } from './mi-tools';
import type { DashboardChannelMix } from './client-dashboard';

function period() {
  return {
    code: 'mois' as const,
    label: 'Mois',
    from: '2026-10-01',
    to: '2026-10-14',
    definition: 'synthétique P2.3',
  };
}

function mixHighDelivery(): DashboardChannelMix {
  return {
    periodRevenue: 100_000,
    deliveryRevenue: 45_000,
    deliverySharePct: 45,
    typedRevenue: 100_000,
    untypedRevenue: 0,
    coveragePct: 100,
    limitations: [],
  };
}

function mixUntyped(): DashboardChannelMix {
  return {
    periodRevenue: 80_000,
    deliveryRevenue: 0,
    deliverySharePct: null,
    typedRevenue: 0,
    untypedRevenue: 80_000,
    coveragePct: 0,
    limitations: [
      'Aucun order_type renseigné sur les commandes de la période — part livraison non calculable.',
    ],
  };
}

function baseInsights(partial: Partial<MiOrgInsights> = {}): MiOrgInsights {
  const p = period();
  const base: MiOrgInsights = {
    organizationId: 'org-p23',
    restaurantName: 'Resto P23',
    timezone: 'Africa/Dakar',
    currency: 'XOF',
    period: p,
    dataQuality: 'ok',
    limits: [],
    kpis: null,
    topClients: [],
    topProducts: [],
    topCategories: [],
    segments: null,
    inactiveLoyal: [],
    clientCount: 30,
    trends: {
      revenue: { current: 1000, previous: 1000, changePct: 0, significant: false },
      visits: { current: 50, previous: 50, changePct: 0, significant: false },
      clientsServed: { current: 40, previous: 40, changePct: 0, significant: false },
      averageBasket: { current: 20, previous: 20, changePct: 0, significant: false },
      newClients: { current: 3, previous: 3, changePct: 0, significant: false },
      comparisonNote: 'stable P2.3',
    },
    opportunities: [],
    customerIntelligence: {
      period: { ...p },
      dataQuality: 'ok',
      metrics: [],
      segments: null,
      medianRecencyDays: null,
    },
    retentionStrategies: [],
    campaignProposals: [],
    channelMix: null,
    reviewsInsight: null,
    recencyLoyalty: null,
    campaignActivity: null,
    measurementWindows: [],
  };
  return { ...base, ...partial, organizationId: partial.organizationId ?? base.organizationId };
}

describe('P2.3 deriveBomayeSignalsFromCrm deliverySharePct', () => {
  it('publie deliverySharePct observed_crm quand channelMix calculable', () => {
    const bridge = deriveBomayeSignalsFromCrm(
      baseInsights({ channelMix: mixHighDelivery() })
    );
    expect(bridge.signals.deliverySharePct).toBe(45);
    expect(bridge.fieldOrigins.deliverySharePct).toBe('observed_crm');
    expect(bridge.facts.some((f) => /Part livraison = 45/.test(f))).toBe(true);
    expect(bridge.signals.foodCostPct).toBeUndefined();
    expect(bridge.signals.netMarginPct).toBeUndefined();
  });

  it('ne force pas deliverySharePct=0 si order_type absent', () => {
    const bridge = deriveBomayeSignalsFromCrm(baseInsights({ channelMix: mixUntyped() }));
    expect(bridge.signals.deliverySharePct).toBeUndefined();
    expect(bridge.limits.join(' ')).toMatch(/jamais forcée à 0/i);
  });

  it('channelMix null → pas de part livraison inventée', () => {
    const bridge = deriveBomayeSignalsFromCrm(baseInsights({ channelMix: null }));
    expect(bridge.signals.deliverySharePct).toBeUndefined();
  });

  it('REGLE-DEC-01 se déclenche via bridge + advisor (45 % > 25 %)', () => {
    const bridge = deriveBomayeSignalsFromCrm(
      baseInsights({ channelMix: mixHighDelivery() })
    );
    const advice = evaluateBomayeAdvisor(
      { dataOrigin: 'observed_crm', ...bridge.signals },
      {
        fieldOrigins: bridge.fieldOrigins,
        crmFacts: bridge.facts,
        crmLimits: bridge.limits,
        miOpportunityRuleIds: bridge.miOpportunityRuleIds,
      }
    );
    expect(advice.fires.some((f) => f.ruleId === 'REGLE-DEC-01')).toBe(true);
    expect(advice.computed.deliverySharePct).toBe(45);
  });
});

describe('P2.3 buildMiProactiveBriefing REGLE-DEC-01', () => {
  it('briefing inclut signal dépendance livraison depuis CRM', () => {
    const source = baseInsights({ channelMix: mixHighDelivery() }) as MiBriefingSource;
    const briefing = buildMiProactiveBriefing(source);
    expect(briefing.status).toBe('ready');
    const deliveryItem = briefing.items.find(
      (i) =>
        /livraison|REGLE-DEC-01|dépendance/i.test(i.title) ||
        /livraison|REGLE-DEC-01/i.test(i.source) ||
        i.evidence.some((e) => /livraison|45/i.test(e))
    );
    expect(deliveryItem).toBeTruthy();
    expect(briefing.missingForBetterBriefing.join(' ')).not.toMatch(/Part livraison \(hors P2\.2\)/);
    expect(briefing.executionNote).toMatch(/consultatif|aucune campagne/i);
  });

  it('sans order_type : missing mentionne order_type, pas 0 % livraison', () => {
    const briefing = buildMiProactiveBriefing(
      baseInsights({ channelMix: mixUntyped() }) as MiBriefingSource
    );
    expect(briefing.missingForBetterBriefing.join(' ')).toMatch(/order_type/i);
    expect(JSON.stringify(briefing)).not.toMatch(/Part livraison = 0/);
  });
});
