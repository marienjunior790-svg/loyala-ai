/**
 * P2.1 — Tests unitaires deriveBomayeSignalsFromCrm + merge (données synthétiques).
 */
import { describe, expect, it } from 'vitest';
import type { MiOrgInsights } from '../mi-tools';
import type { MiOpportunity } from '../mi-opportunities';
import {
  deriveBomayeSignalsFromCrm,
  mergeBomayeSignalSources,
} from './bomaye-crm-bridge';
import { evaluateBomayeAdvisor } from './bomaye-advisor';
import type { BomayeAdvisorSignals } from './bomaye-advisor';

function baseInsights(partial: Partial<MiOrgInsights> = {}): MiOrgInsights {
  const period = {
    code: 'mois' as const,
    label: 'Mois',
    from: '2026-10-01',
    to: '2026-10-18',
    definition: 'synthétique P2.1',
  };
  const base: MiOrgInsights = {
    organizationId: 'org-synth-p21',
    restaurantName: 'Resto Synth P21',
    timezone: 'Africa/Dakar',
    currency: 'XOF',
    period,
    dataQuality: 'ok',
    limits: [],
    kpis: null,
    topClients: [],
    topProducts: [],
    topCategories: [],
    segments: null,
    inactiveLoyal: [],
    clientCount: 25,
    trends: null,
    opportunities: [],
    customerIntelligence: {
      period: { ...period },
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
  return {
    ...base,
    ...partial,
    organizationId: partial.organizationId ?? base.organizationId,
  };
}

function revenueDropOpp(): MiOpportunity {
  return {
    id: 'revenue_drop_significant',
    ruleId: 'revenue_drop_significant',
    priority: 'high',
    facts: ['CA −28 %'],
    detectionRule: 'Baisse CA ≥ 20 %',
    period: { code: 'mois', label: 'Mois', from: '2026-10-01', to: '2026-10-18' },
    limits: [],
    suggestedAction: 'Analyser',
    rankScore: 300,
  };
}

describe('deriveBomayeSignalsFromCrm', () => {
  it('dérive variation CA significative sans inventer food cost / marge / ROI', () => {
    const insights = baseInsights({
      trends: {
        revenue: { current: 720, previous: 1000, changePct: -28, significant: true },
        visits: { current: 40, previous: 42, changePct: -4.76, significant: false },
        clientsServed: { current: 30, previous: 32, changePct: -6.25, significant: false },
        averageBasket: { current: 18, previous: 24, changePct: -25, significant: true },
        newClients: { current: 5, previous: 6, changePct: -16.7, significant: false },
        comparisonNote: 'Comparaison vs période précédente.',
      },
      opportunities: [revenueDropOpp()],
    });
    const bridge = deriveBomayeSignalsFromCrm(insights);
    expect(bridge.signals.revenueChangePct).toBe(-28);
    expect(bridge.fieldOrigins.revenueChangePct).toBe('observed_crm');
    expect(bridge.signals.foodCostPct).toBeUndefined();
    expect(bridge.signals.netMarginPct).toBeUndefined();
    expect(bridge.signals.deliverySharePct).toBeUndefined();
    expect(bridge.limits.join(' ')).toMatch(/Food Cost|marge|ROI|livraison/i);
    expect(bridge.miOpportunityRuleIds).toContain('revenue_drop_significant');
    expect(bridge.facts.some((f) => /Variation CA = -28/.test(f))).toBe(true);
  });

  it('dérive variation visites significative', () => {
    const insights = baseInsights({
      trends: {
        revenue: { current: 900, previous: 950, changePct: -5.26, significant: false },
        visits: { current: 20, previous: 40, changePct: -50, significant: true },
        clientsServed: { current: 18, previous: 35, changePct: -48.6, significant: true },
        averageBasket: { current: 45, previous: 27, changePct: 66.7, significant: true },
        newClients: { current: 2, previous: 4, changePct: -50, significant: false },
        comparisonNote: 'note',
      },
      opportunities: [
        {
          ...revenueDropOpp(),
          id: 'visits_drop_significant',
          ruleId: 'visits_drop_significant',
        },
      ],
    });
    const bridge = deriveBomayeSignalsFromCrm(insights);
    expect(bridge.signals.visitsChangePct).toBe(-50);
    expect(bridge.fieldOrigins.visitsChangePct).toBe('observed_crm');
    expect(bridge.insufficientForTrends).toBe(false);
  });

  it('org sans client : clientContactCount=0 observé, pas de tendances inventées', () => {
    const insights = baseInsights({
      clientCount: 0,
      dataQuality: 'insufficient',
      limits: ['Aucun client actif dans cette organisation.'],
      trends: null,
      opportunities: [],
    });
    const bridge = deriveBomayeSignalsFromCrm(insights);
    expect(bridge.signals.clientContactCount).toBe(0);
    expect(bridge.signals.hasCrmOrLoyalty).toBe(false);
    expect(bridge.signals.revenueChangePct).toBeUndefined();
    expect(bridge.signals.visitsChangePct).toBeUndefined();
    expect(bridge.insufficientForTrends).toBe(true);
    expect(bridge.limits.join(' ')).toMatch(/insufficient|tendances/i);
  });

  it('changePct null n’est pas remplacé par 0', () => {
    const insights = baseInsights({
      trends: {
        revenue: { current: 100, previous: 0, changePct: null, significant: false },
        visits: { current: 5, previous: 0, changePct: null, significant: false },
        clientsServed: { current: 4, previous: 0, changePct: null, significant: false },
        averageBasket: { current: 20, previous: 0, changePct: null, significant: false },
        newClients: { current: 4, previous: 0, changePct: null, significant: false },
        comparisonNote: 'note',
      },
    });
    const bridge = deriveBomayeSignalsFromCrm(insights);
    expect(bridge.signals.revenueChangePct).toBeUndefined();
    expect(bridge.signals.visitsChangePct).toBeUndefined();
    expect(bridge.limits.join(' ')).toMatch(/non calculable|null/i);
  });
});

describe('mergeBomayeSignalSources — conflits', () => {
  it('conserve observed_crm et signale la divergence déclaré vs observé', () => {
    const crm = deriveBomayeSignalsFromCrm(
      baseInsights({
        trends: {
          revenue: { current: 700, previous: 1000, changePct: -30, significant: true },
          visits: { current: 25, previous: 50, changePct: -50, significant: true },
          clientsServed: { current: 20, previous: 40, changePct: -50, significant: true },
          averageBasket: { current: 28, previous: 25, changePct: 12, significant: false },
          newClients: { current: 3, previous: 5, changePct: -40, significant: false },
          comparisonNote: 'note',
        },
        opportunities: [revenueDropOpp()],
      })
    );
    const declared: BomayeAdvisorSignals = {
      dataOrigin: 'user_declared',
      visitsChangePct: -10, // contredit −50 CRM
      consideringGeneralPriceCutPct: 20,
    };
    const merged = mergeBomayeSignalSources({ crm, declared });
    expect(merged.signals.visitsChangePct).toBe(-50);
    expect(merged.fieldOrigins.visitsChangePct).toBe('observed_crm');
    expect(merged.signals.consideringGeneralPriceCutPct).toBe(20);
    expect(merged.fieldOrigins.consideringGeneralPriceCutPct).toBe('user_declared');
    expect(merged.conflicts.some((c) => c.field === 'visitsChangePct')).toBe(true);
    expect(merged.signals.dataOrigin).toBe('observed_crm');

    const advice = evaluateBomayeAdvisor(merged.signals, {
      fieldOrigins: merged.fieldOrigins,
      conflicts: merged.conflicts,
      crmFacts: merged.crmFacts,
      miOpportunityRuleIds: merged.miOpportunityRuleIds,
    });
    expect(advice.conflicts?.length).toBeGreaterThan(0);
    expect(advice.observedFacts.join(' ')).toMatch(/observed_crm|-50/);
    expect(advice.fires.some((f) => f.ruleId === 'CASE-PRICE-CUT')).toBe(true);
    // Pas d'invention finance
    expect(advice.computed.foodCostPct).toBeNull();
    expect(JSON.stringify(advice)).not.toMatch(/ROI\s*=\s*\d/);
  });
});
