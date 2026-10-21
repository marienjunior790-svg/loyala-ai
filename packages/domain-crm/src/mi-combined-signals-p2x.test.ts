/**
 * Test combiné multi-signaux P2.1–P2.6 (non destructif).
 * Vérifie briefing + bridge sans forcer tous les signaux dans chaque scénario.
 */
import { describe, expect, it } from 'vitest';
import { computeMiReviewsInsight } from './mi-reviews';
import { computeMiRecencyLoyaltyInsight } from './mi-recency-loyalty';
import { computeMiCampaignActivityInsight } from './mi-campaign-activity';
import { computeDeliveryChannelMix } from './client-dashboard';
import { deriveBomayeSignalsFromCrm } from './knowledge/bomaye-crm-bridge';
import { evaluateBomayeAdvisor } from './knowledge/bomaye-advisor';
import { buildMiProactiveBriefing, type MiBriefingSource } from './mi-proactive-briefing';
import { buildMiMeasurementWindows, type MiOrgInsights } from './mi-tools';
import type { MiOpportunity } from './mi-opportunities';
import { INACTIVE_DAYS_THRESHOLD } from './segments';

const NOW = new Date('2026-10-18T12:00:00Z');
const TZ = 'Africa/Dakar';
const PERIOD = {
  code: 'mois' as const,
  label: 'Mois',
  from: '2026-10-01',
  to: '2026-10-18',
  definition: 'Du 1er du mois…',
};

function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function opp(ruleId: MiOpportunity['ruleId']): MiOpportunity {
  return {
    id: ruleId,
    ruleId,
    priority: 'high',
    facts: [`Fait ${ruleId}`],
    detectionRule: ruleId,
    period: { code: 'mois', label: 'Mois', from: PERIOD.from, to: PERIOD.to },
    limits: ['Variation ≠ cause'],
    suggestedAction: `Action ${ruleId}`,
    rankScore: 300,
  };
}

function base(partial: Partial<MiOrgInsights> = {}): MiOrgInsights {
  const windows = buildMiMeasurementWindows({
    period: PERIOD,
    previousFrom: '2026-09-01',
    previousTo: '2026-09-18',
    now: NOW,
    timezone: TZ,
  });
  const baseInsights: MiOrgInsights = {
    organizationId: 'org-combined-A',
    restaurantName: 'Resto Combiné',
    timezone: TZ,
    currency: 'XOF',
    period: PERIOD,
    dataQuality: 'ok',
    limits: [],
    kpis: null,
    topClients: [],
    topProducts: [],
    topCategories: [],
    segments: null,
    inactiveLoyal: [],
    clientCount: 40,
    trends: null,
    opportunities: [],
    customerIntelligence: {
      period: { ...PERIOD },
      dataQuality: 'ok',
      metrics: [],
      segments: null,
      medianRecencyDays: 12,
    },
    retentionStrategies: [],
    campaignProposals: [],
    channelMix: null,
    reviewsInsight: null,
    recencyLoyalty: null,
    campaignActivity: null,
    measurementWindows: windows,
  };
  return {
    ...baseInsights,
    ...partial,
    organizationId: partial.organizationId ?? baseInsights.organizationId,
    measurementWindows: partial.measurementWindows ?? windows,
  };
}

describe('Scénario combiné multi-signaux', () => {
  it('CA↓ + visites↓ + livraison↑ + avis↓ + pending campagnes → faits, provenances, pas de doublon famille', () => {
    const channelMix = computeDeliveryChannelMix(
      [
        { day: '2026-10-05', amount: 45_000, orderType: 'livraison' },
        { day: '2026-10-06', amount: 45_000, orderType: 'livraison' },
        { day: '2026-10-07', amount: 10_000, orderType: 'sur_place' },
      ],
      { start: PERIOD.from, end: PERIOD.to }
    );
    expect(channelMix.deliverySharePct).toBe(90);

    const reviewsInsight = computeMiReviewsInsight({
      timezone: TZ,
      period: { from: PERIOD.from, to: PERIOD.to, label: PERIOD.label },
      previousPeriod: { from: '2026-09-01', to: '2026-09-18' },
      sampleFetchLimit: 200,
      totalMatchingInWindow: 6,
      reviews: [
        { rating: 5, content: 'ok', reviewed_at: '2026-09-05T12:00:00Z', response_text: null, source: 'google' },
        { rating: 5, content: 'ok', reviewed_at: '2026-09-06T12:00:00Z', response_text: null, source: 'google' },
        { rating: 5, content: 'ok', reviewed_at: '2026-09-07T12:00:00Z', response_text: null, source: 'google' },
        { rating: 2, content: 'bof', reviewed_at: '2026-10-05T12:00:00Z', response_text: null, source: 'google' },
        { rating: 3, content: 'bof', reviewed_at: '2026-10-06T12:00:00Z', response_text: null, source: 'google' },
        { rating: 2, content: 'bof', reviewed_at: '2026-10-07T12:00:00Z', response_text: null, source: 'google' },
      ],
    });
    expect(reviewsInsight.sampleComplete).toBe(true);
    expect(reviewsInsight.trend).toBe('down');
    expect(reviewsInsight.averageRating).toBeLessThan(4);

    const recencyLoyalty = computeMiRecencyLoyaltyInsight({
      now: NOW,
      clients: [
        {
          id: 'a',
          visit_count: 5,
          last_visit_at: daysAgo(INACTIVE_DAYS_THRESHOLD + 3),
          total_spent: 80_000,
          created_at: daysAgo(200),
        },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `r${i}`,
          visit_count: 1,
          last_visit_at: daysAgo(3 + i),
          total_spent: 5_000,
          created_at: daysAgo(100),
        })),
      ],
      visits: Array.from({ length: 8 }, (_, i) => ({
        client_id: `r${i}`,
        visited_at: daysAgo(3 + i),
      })),
    });

    const campaignActivity = computeMiCampaignActivityInsight({
      timezone: TZ,
      period: { from: PERIOD.from, to: PERIOD.to, label: PERIOD.label },
      campaigns: [
        {
          type: 'inactive',
          status: 'ready',
          target_count: 20,
          created_at: '2026-10-05T12:00:00Z',
          scheduled_at: null,
        },
      ],
      sends: [
        ...Array.from({ length: 6 }, () => ({
          status: 'pending',
          created_at: '2026-10-06T12:00:00Z',
          sent_at: null,
        })),
        ...Array.from({ length: 4 }, () => ({
          status: 'sent',
          created_at: '2026-10-07T12:00:00Z',
          sent_at: '2026-10-07T12:00:00Z',
        })),
        {
          status: 'failed',
          created_at: '2026-10-08T12:00:00Z',
          sent_at: null,
        },
      ],
    });
    expect(campaignActivity.pendingSharePct).toBeGreaterThan(50);

    const insights = base({
      trends: {
        revenue: { current: 700, previous: 1000, changePct: -30, significant: true },
        visits: { current: 20, previous: 40, changePct: -50, significant: true },
        clientsServed: { current: 18, previous: 35, changePct: -48, significant: true },
        averageBasket: { current: 35, previous: 25, changePct: 40, significant: true },
        newClients: { current: 2, previous: 5, changePct: -60, significant: true },
        comparisonNote: 'Comparaison synthétique combinée.',
      },
      opportunities: [opp('revenue_drop_significant'), opp('visits_drop_significant')],
      channelMix,
      reviewsInsight,
      recencyLoyalty,
      campaignActivity,
    });

    const bridge = deriveBomayeSignalsFromCrm(insights);
    expect(bridge.fieldOrigins.revenueChangePct).toBe('observed_crm');
    expect(bridge.fieldOrigins.visitsChangePct).toBe('observed_crm');
    expect(bridge.fieldOrigins.deliverySharePct).toBe('observed_crm');
    expect(bridge.fieldOrigins.avgReviewScore).toBe('observed_crm');
    expect(bridge.signals.deliverySharePct).toBe(90);
    expect(bridge.signals.avgReviewScore).toBe(reviewsInsight.averageRating);
    expect(bridge.limits.join(' ')).toMatch(/Food Cost|ROI|marge/i);
    expect(JSON.stringify(bridge.signals)).not.toMatch(/foodCostPct|netMarginPct|roi/i);

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
    expect(advice.fires.some((f) => f.ruleId === 'CASE-NEGATIVE-REVIEWS')).toBe(true);

    const briefing = buildMiProactiveBriefing(insights as MiBriefingSource);
    expect(briefing.status).toBe('ready');
    expect(briefing.executionNote).toMatch(/consultatif|aucune campagne/i);

    const familyKeys = briefing.items.map((i) => i.familyKey);
    expect(new Set(familyKeys).size).toBe(familyKeys.length);

    expect(briefing.items.some((i) => i.familyKey === 'activity_drop')).toBe(true);
    expect(briefing.items.some((i) => i.familyKey === 'reviews_quality')).toBe(true);
    expect(briefing.items.some((i) => i.familyKey === 'campaign_activity')).toBe(true);
    expect(briefing.items.some((i) => i.familyKey === 'inactive_reconquest')).toBe(true);

    // Pas de conclusion causale inventée sur la note seule
    const reviewItem = briefing.items.find((i) => i.familyKey === 'reviews_quality');
    expect(reviewItem?.interpretation).toMatch(/ne démontre pas la cause/i);

    // Fenêtres distinctes documentées
    expect(insights.measurementWindows.some((w) => w.id === 'recency_sliding' && !w.alignedWithDashboard)).toBe(
      true
    );
    expect(briefing.limitations.join(' ')).toMatch(/glissant|Récence|distincte/i);
  });

  it('données manquantes : pas de 0 inventés pour livraison / avis / repeat / marquage', () => {
    const insights = base({
      dataQuality: 'partial',
      channelMix: computeDeliveryChannelMix(
        [{ day: '2026-10-05', amount: 10_000, orderType: null }],
        { start: PERIOD.from, end: PERIOD.to }
      ),
      reviewsInsight: computeMiReviewsInsight({
        timezone: TZ,
        period: { from: PERIOD.from, to: PERIOD.to, label: PERIOD.label },
        previousPeriod: { from: '2026-09-01', to: '2026-09-18' },
        reviews: [],
        sampleFetchLimit: 200,
        totalMatchingInWindow: 0,
      }),
      recencyLoyalty: computeMiRecencyLoyaltyInsight({ now: NOW, clients: [] }),
      campaignActivity: computeMiCampaignActivityInsight({
        timezone: TZ,
        period: { from: PERIOD.from, to: PERIOD.to, label: PERIOD.label },
        campaigns: [],
        sends: [],
      }),
    });

    expect(insights.channelMix?.deliverySharePct).toBeNull();
    expect(insights.reviewsInsight?.averageRating).toBeNull();
    expect(insights.recencyLoyalty?.repeatRate60dPct).toBeNull();
    expect(insights.campaignActivity?.markedSentRatePct).toBeNull();

    const bridge = deriveBomayeSignalsFromCrm(insights);
    expect(bridge.signals.deliverySharePct).toBeUndefined();
    expect(bridge.signals.avgReviewScore).toBeUndefined();
    expect(bridge.signals.repeatRate60dPct).toBeUndefined();

    const briefing = buildMiProactiveBriefing(insights as MiBriefingSource);
    expect(JSON.stringify(briefing)).not.toMatch(/ROI\s*=\s*\d|Food Cost\s*=\s*\d/i);
    expect(briefing.missingForBetterBriefing.length).toBeGreaterThan(0);
  });

  it('isolation org-A / org-B sur briefing combiné', () => {
    const a = buildMiProactiveBriefing(
      base({
        organizationId: 'org-combined-A',
        channelMix: computeDeliveryChannelMix(
          [
            { day: '2026-10-05', amount: 80_000, orderType: 'livraison' },
            { day: '2026-10-06', amount: 20_000, orderType: 'sur_place' },
          ],
          { start: PERIOD.from, end: PERIOD.to }
        ),
      }) as MiBriefingSource
    );
    const b = buildMiProactiveBriefing(
      base({
        organizationId: 'org-combined-B',
        clientCount: 0,
        dataQuality: 'insufficient',
      }) as MiBriefingSource
    );
    expect(JSON.stringify(a)).not.toMatch(/org-combined-B/);
    expect(b.status).toBe('insufficient');
  });
});

describe('Complétude échantillon avis', () => {
  it('sampleComplete=false quand totalMatching > chargé', () => {
    const insight = computeMiReviewsInsight({
      timezone: TZ,
      period: { from: PERIOD.from, to: PERIOD.to, label: PERIOD.label },
      reviews: [
        { rating: 4, content: 'a', reviewed_at: '2026-10-05T12:00:00Z', response_text: null, source: 'google' },
      ],
      sampleFetchLimit: 200,
      totalMatchingInWindow: 500,
    });
    expect(insight.sampleComplete).toBe(false);
    expect(insight.limitations.join(' ')).toMatch(/tronqué|non exhaustives/i);
  });

  it('sampleComplete=null si plafond atteint sans count', () => {
    const reviews = Array.from({ length: 5 }, (_, i) => ({
      rating: 4,
      content: 'x',
      reviewed_at: `2026-10-0${i + 1}T12:00:00Z`,
      response_text: null,
      source: 'google',
    }));
    const insight = computeMiReviewsInsight({
      timezone: TZ,
      period: { from: PERIOD.from, to: PERIOD.to, label: PERIOD.label },
      reviews,
      sampleFetchLimit: 5,
      totalMatchingInWindow: null,
    });
    expect(insight.sampleComplete).toBeNull();
    expect(insight.limitations.join(' ')).toMatch(/incertaine|exhaustive/i);
  });
});
