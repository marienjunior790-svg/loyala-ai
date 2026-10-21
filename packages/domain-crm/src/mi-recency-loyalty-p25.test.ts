/**
 * P2.5 — Récence / fidélisation (fixtures synthétiques).
 */
import { describe, expect, it } from 'vitest';
import {
  computeMiRecencyLoyaltyInsight,
  MI_REPEAT_RATE_MIN_COHORT,
  type MiRecencyLoyaltyInsight,
} from './mi-recency-loyalty';
import { INACTIVE_DAYS_THRESHOLD } from './segments';
import { deriveBomayeSignalsFromCrm } from './knowledge/bomaye-crm-bridge';
import { evaluateBomayeAdvisor } from './knowledge/bomaye-advisor';
import { buildMiProactiveBriefing, type MiBriefingSource } from './mi-proactive-briefing';
import type { MiOrgInsights } from './mi-tools';

const NOW = new Date('2026-10-18T12:00:00Z');

function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function client(
  id: string,
  visitCount: number,
  lastDaysAgo: number | null,
  totalSpent = 10_000
) {
  return {
    id,
    visit_count: visitCount,
    last_visit_at: lastDaysAgo === null ? null : daysAgo(lastDaysAgo),
    total_spent: totalSpent,
    created_at: daysAgo(120),
  };
}

function baseInsights(partial: Partial<MiOrgInsights> = {}): MiOrgInsights {
  const p = {
    code: 'mois' as const,
    label: 'Mois',
    from: '2026-10-01',
    to: '2026-10-18',
    definition: 'synthétique P2.5',
  };
  const base: MiOrgInsights = {
    organizationId: 'org-p25-A',
    restaurantName: 'Resto P25',
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
    clientCount: 10,
    trends: null,
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

describe('computeMiRecencyLoyaltyInsight P2.5', () => {
  it('détecte autrefois réguliers inactifs (≠ perdus)', () => {
    const insight = computeMiRecencyLoyaltyInsight({
      now: NOW,
      clients: [
        client('a', 5, INACTIVE_DAYS_THRESHOLD + 5),
        client('b', 4, INACTIVE_DAYS_THRESHOLD + 10),
        client('c', 2, 3), // actif récent
      ],
    });
    expect(insight.formerlyRegularInactiveCount).toBe(2);
    expect(insight.recentActiveCount).toBe(1);
    expect(insight.limitations.join(' ')).toMatch(/Inactif ≠ perdu/i);
  });

  it('absence de clients → repeat rate null', () => {
    const insight = computeMiRecencyLoyaltyInsight({ now: NOW, clients: [] });
    expect(insight.repeatRate60dPct).toBeNull();
    expect(insight.clientCount).toBe(0);
  });

  it('cohort trop petite → pas de repeat rate inventé à 0', () => {
    const insight = computeMiRecencyLoyaltyInsight({
      now: NOW,
      clients: [client('a', 2, 5), client('b', 1, 2)],
    });
    expect(insight.repeatRateCohortSize).toBeLessThan(MI_REPEAT_RATE_MIN_COHORT);
    expect(insight.repeatRate60dPct).toBeNull();
  });

  it('proxy lifetime avec cohort suffisante', () => {
    const clients = Array.from({ length: 6 }, (_, i) =>
      client(`c${i}`, i % 2 === 0 ? 3 : 1, 5 + i)
    );
    const insight = computeMiRecencyLoyaltyInsight({ now: NOW, clients });
    expect(insight.repeatRateMethod).toBe('lifetime_proxy');
    expect(insight.repeatRate60dPct).not.toBeNull();
    expect(insight.frequencyCoolingCount).toBeNull();
  });

  it('visit_windows : repeat rate + refroidissement', () => {
    const clients = Array.from({ length: 6 }, (_, i) => client(`c${i}`, 3, 10));
    const visits = [
      // 5 clients actifs 0–60 j
      { client_id: 'c0', visited_at: daysAgo(5) },
      { client_id: 'c1', visited_at: daysAgo(10) },
      { client_id: 'c2', visited_at: daysAgo(15) },
      { client_id: 'c3', visited_at: daysAgo(20) },
      { client_id: 'c4', visited_at: daysAgo(25) },
      // 3 d’entre eux aussi sur 60–120
      { client_id: 'c0', visited_at: daysAgo(70) },
      { client_id: 'c1', visited_at: daysAgo(80) },
      { client_id: 'c2', visited_at: daysAgo(90) },
      // cooling : denser prior half than recent half
      { client_id: 'cool', visited_at: daysAgo(40) },
      { client_id: 'cool', visited_at: daysAgo(45) },
      { client_id: 'cool', visited_at: daysAgo(50) },
      { client_id: 'cool', visited_at: daysAgo(10) },
    ];
    const insight = computeMiRecencyLoyaltyInsight({ now: NOW, clients, visits });
    expect(insight.repeatRateMethod).toBe('visit_windows');
    expect(insight.repeatRateCohortSize).toBeGreaterThanOrEqual(5);
    expect(insight.repeatRateRepeaters).toBe(3);
    expect(insight.repeatRate60dPct).toBe(
      roundExpected(insight.repeatRateRepeaters, insight.repeatRateCohortSize)
    );
    expect(insight.frequencyCoolingCount).toBeGreaterThanOrEqual(1);
  });

  it('ne confond pas at_risk faible historique avec autrefois régulier', () => {
    const insight = computeMiRecencyLoyaltyInsight({
      now: NOW,
      clients: [
        client('weak', 1, INACTIVE_DAYS_THRESHOLD + 3),
        client('strong', 5, INACTIVE_DAYS_THRESHOLD + 3),
      ],
    });
    expect(insight.formerlyRegularInactiveCount).toBe(1);
    expect(insight.atRiskCount).toBe(1);
  });
});

function roundExpected(repeaters: number, cohort: number): number {
  return Math.round((repeaters / cohort) * 10000) / 100;
}

describe('P2.5 bridge Bomaye REGLE-DEC-02', () => {
  function lowRepeat(): MiRecencyLoyaltyInsight {
    return computeMiRecencyLoyaltyInsight({
      now: NOW,
      clients: Array.from({ length: 10 }, (_, i) => client(`r${i}`, 1, 3)),
      visits: Array.from({ length: 10 }, (_, i) => ({
        client_id: `r${i}`,
        visited_at: daysAgo(5 + i),
      })),
    });
  }

  it('publie repeatRate60dPct observed_crm et peut déclencher REGLE-DEC-02', () => {
    const recencyLoyalty = lowRepeat();
    expect(recencyLoyalty.repeatRate60dPct).not.toBeNull();
    expect(recencyLoyalty.repeatRate60dPct!).toBeLessThan(20);

    const bridge = deriveBomayeSignalsFromCrm(baseInsights({ recencyLoyalty, clientCount: 10 }));
    expect(bridge.signals.repeatRate60dPct).toBe(recencyLoyalty.repeatRate60dPct);
    expect(bridge.fieldOrigins.repeatRate60dPct).toBe('observed_crm');
    expect(bridge.facts.join(' ')).toMatch(/Inactif ≠ perdu|autrefois réguliers/i);

    const advice = evaluateBomayeAdvisor(
      { dataOrigin: 'observed_crm', ...bridge.signals },
      {
        fieldOrigins: bridge.fieldOrigins,
        crmFacts: bridge.facts,
        crmLimits: bridge.limits,
        miOpportunityRuleIds: [],
      }
    );
    expect(advice.fires.some((f) => f.ruleId === 'REGLE-DEC-02')).toBe(true);
  });

  it('pas de repeat rate inventé si recencyLoyalty null', () => {
    const bridge = deriveBomayeSignalsFromCrm(baseInsights({ recencyLoyalty: null }));
    expect(bridge.signals.repeatRate60dPct).toBeUndefined();
  });
});

describe('P2.5 briefing', () => {
  it('expose autrefois réguliers + limite no auto-send', () => {
    const recencyLoyalty = computeMiRecencyLoyaltyInsight({
      now: NOW,
      clients: [
        client('a', 5, INACTIVE_DAYS_THRESHOLD + 2),
        client('b', 4, INACTIVE_DAYS_THRESHOLD + 4),
        client('c', 3, INACTIVE_DAYS_THRESHOLD + 6),
      ],
    });
    const briefing = buildMiProactiveBriefing(
      baseInsights({ recencyLoyalty, clientCount: 3 }) as MiBriefingSource
    );
    const item = briefing.items.find((i) => i.familyKey === 'inactive_reconquest');
    expect(item).toBeTruthy();
    expect(item!.title).toMatch(/autrefois régulier/i);
    expect(item!.interpretation).toMatch(/≠ perdu|pas de conclusion/i);
    expect(briefing.executionNote).toMatch(/consultatif|aucune campagne/i);
  });

  it('isolation org-A / org-B', () => {
    const a = buildMiProactiveBriefing(
      baseInsights({
        organizationId: 'org-p25-A',
        recencyLoyalty: computeMiRecencyLoyaltyInsight({
          now: NOW,
          clients: [client('x', 5, INACTIVE_DAYS_THRESHOLD + 1)],
        }),
      }) as MiBriefingSource
    );
    const b = buildMiProactiveBriefing(
      baseInsights({
        organizationId: 'org-p25-B',
        clientCount: 0,
        recencyLoyalty: computeMiRecencyLoyaltyInsight({ now: NOW, clients: [] }),
      }) as MiBriefingSource
    );
    expect(JSON.stringify(a)).not.toMatch(/org-p25-B/);
    expect(JSON.stringify(b)).not.toMatch(/autrefois régulier\(s\) sans visite/);
  });
});
