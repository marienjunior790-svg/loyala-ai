/**
 * P2.4 — Avis clients → MI / Bomaye / briefing (données synthétiques).
 */
import { describe, expect, it } from 'vitest';
import {
  computeMiReviewsInsight,
  MI_REVIEWS_TREND_MIN_RATED,
} from './mi-reviews';
import { deriveBomayeSignalsFromCrm } from './knowledge/bomaye-crm-bridge';
import { evaluateBomayeAdvisor } from './knowledge/bomaye-advisor';
import { buildMiProactiveBriefing, type MiBriefingSource } from './mi-proactive-briefing';
import type { MiOrgInsights } from './mi-tools';
import type { MiReviewsInsight } from './mi-reviews';

const TZ = 'Africa/Dakar';
const PERIOD = { from: '2026-10-01', to: '2026-10-14', label: 'Mois' };
const PREV = { from: '2026-09-01', to: '2026-09-14' };

function row(
  rating: number | null,
  day: string,
  content = 'ok',
  extras: Partial<{ source: string; response_text: string | null }> = {}
) {
  return {
    rating: rating as number,
    content,
    reviewed_at: `${day}T12:00:00Z`,
    response_text: extras.response_text ?? null,
    source: extras.source ?? 'google',
  };
}

function baseInsights(partial: Partial<MiOrgInsights> = {}): MiOrgInsights {
  const p = {
    code: 'mois' as const,
    label: 'Mois',
    from: '2026-10-01',
    to: '2026-10-14',
    definition: 'synthétique P2.4',
  };
  const base: MiOrgInsights = {
    organizationId: 'org-p24-A',
    restaurantName: 'Resto P24',
    timezone: TZ,
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
    clientCount: 25,
    trends: {
      revenue: { current: 1000, previous: 1000, changePct: 0, significant: false },
      visits: { current: 40, previous: 40, changePct: 0, significant: false },
      clientsServed: { current: 30, previous: 30, changePct: 0, significant: false },
      averageBasket: { current: 25, previous: 25, changePct: 0, significant: false },
      newClients: { current: 2, previous: 2, changePct: 0, significant: false },
      comparisonNote: 'stable',
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

describe('computeMiReviewsInsight P2.4', () => {
  it('plusieurs avis avec notes valides → volume + moyenne', () => {
    const insight = computeMiReviewsInsight({
      reviews: [
        row(5, '2026-10-05'),
        row(4, '2026-10-06'),
        row(3, '2026-10-07'),
        row(5, '2026-10-08'),
      ],
      period: PERIOD,
      previousPeriod: PREV,
      timezone: TZ,
    });
    expect(insight.periodReviewCount).toBe(4);
    expect(insight.ratedCount).toBe(4);
    expect(insight.averageRating).toBe(4.25);
    expect(insight.limitations.join(' ')).toMatch(/thématique|sentiment/i);
  });

  it('absence totale d’avis → averageRating null (pas 0)', () => {
    const insight = computeMiReviewsInsight({
      reviews: [],
      period: PERIOD,
      previousPeriod: PREV,
      timezone: TZ,
    });
    expect(insight.averageRating).toBeNull();
    expect(insight.periodReviewCount).toBe(0);
    expect(insight.limitations.join(' ')).toMatch(/Aucun avis/i);
  });

  it('avis sans note valide → moyenne non publiée', () => {
    const insight = computeMiReviewsInsight({
      reviews: [
        row(Number.NaN, '2026-10-05', 'texte'),
        row(0 as unknown as number, '2026-10-06', 'texte'),
        row(9 as unknown as number, '2026-10-07', 'texte'),
      ],
      period: PERIOD,
      previousPeriod: PREV,
      timezone: TZ,
    });
    expect(insight.periodReviewCount).toBe(3);
    expect(insight.ratedCount).toBe(0);
    expect(insight.averageRating).toBeNull();
  });

  it('commentaires absents ou vides comptés séparément', () => {
    const insight = computeMiReviewsInsight({
      reviews: [
        row(5, '2026-10-05', ''),
        row(4, '2026-10-06', '   '),
        row(5, '2026-10-07', 'Excellent thieb'),
      ],
      period: PERIOD,
      previousPeriod: PREV,
      timezone: TZ,
    });
    expect(insight.withCommentCount).toBe(1);
    expect(insight.ratedCount).toBe(3);
    expect(insight.averageRating).toBeCloseTo(4.67, 1);
  });

  it('données temporelles insuffisantes → trend null', () => {
    const insight = computeMiReviewsInsight({
      reviews: [
        row(5, '2026-10-05'),
        row(4, '2026-10-06'),
        // previous: only 1 (< MIN)
        row(5, '2026-09-05'),
      ],
      period: PERIOD,
      previousPeriod: PREV,
      timezone: TZ,
    });
    expect(insight.ratedCount).toBe(2);
    expect(insight.previousRatedCount).toBe(1);
    expect(insight.trend).toBeNull();
    expect(insight.reviewTrendDown).toBeNull();
    expect(insight.limitations.join(' ')).toMatch(
      new RegExp(`≥ ${MI_REVIEWS_TREND_MIN_RATED}`)
    );
  });

  it('tendance down fiable quand volumes suffisants', () => {
    const insight = computeMiReviewsInsight({
      reviews: [
        row(5, '2026-09-02'),
        row(5, '2026-09-03'),
        row(5, '2026-09-04'),
        row(3, '2026-10-05'),
        row(3, '2026-10-06'),
        row(3, '2026-10-07'),
      ],
      period: PERIOD,
      previousPeriod: PREV,
      timezone: TZ,
    });
    expect(insight.previousAverageRating).toBe(5);
    expect(insight.averageRating).toBe(3);
    expect(insight.trend).toBe('down');
    expect(insight.reviewTrendDown).toBe(true);
    expect(insight.averageDelta).toBe(-2);
  });
});

describe('P2.4 bridge + Bomaye', () => {
  function insightLow(): MiReviewsInsight {
    return computeMiReviewsInsight({
      reviews: [
        row(3, '2026-10-05'),
        row(3, '2026-10-06'),
        row(2, '2026-10-07'),
        row(3, '2026-10-08'),
      ],
      period: PERIOD,
      previousPeriod: PREV,
      timezone: TZ,
    });
  }

  it('provenance observed_crm + CASE-NEGATIVE-REVIEWS via seuil Bomaye 4.0', () => {
    const bridge = deriveBomayeSignalsFromCrm(
      baseInsights({ reviewsInsight: insightLow() })
    );
    expect(bridge.signals.avgReviewScore).toBe(2.75);
    expect(bridge.fieldOrigins.avgReviewScore).toBe('observed_crm');
    expect(bridge.facts.some((f) => /Note avis moyenne = 2\.75/.test(f))).toBe(true);

    const advice = evaluateBomayeAdvisor(
      { dataOrigin: 'observed_crm', ...bridge.signals },
      {
        fieldOrigins: bridge.fieldOrigins,
        crmFacts: bridge.facts,
        crmLimits: bridge.limits,
        miOpportunityRuleIds: [],
      }
    );
    expect(advice.fires.some((f) => f.ruleId === 'CASE-NEGATIVE-REVIEWS')).toBe(true);
  });

  it('pas de note inventée si reviewsInsight null', () => {
    const bridge = deriveBomayeSignalsFromCrm(baseInsights({ reviewsInsight: null }));
    expect(bridge.signals.avgReviewScore).toBeUndefined();
    expect(bridge.limits.join(' ')).toMatch(/jamais forcée à 0/i);
  });

  it('pas de conclusion causale produit dans les faits bridge', () => {
    const bridge = deriveBomayeSignalsFromCrm(
      baseInsights({ reviewsInsight: insightLow() })
    );
    expect(bridge.facts.join(' ')).not.toMatch(/cause|parce que|cuisine défaillante/i);
  });
});

describe('P2.4 briefing', () => {
  it('présente constat, volume, période, provenance, limites', () => {
    const reviewsInsight = computeMiReviewsInsight({
      reviews: [row(5, '2026-10-05'), row(4, '2026-10-06'), row(5, '2026-10-07')],
      period: PERIOD,
      previousPeriod: PREV,
      timezone: TZ,
    });
    const briefing = buildMiProactiveBriefing(
      baseInsights({ reviewsInsight }) as MiBriefingSource
    );
    const item = briefing.items.find((i) => i.familyKey === 'reviews_quality');
    expect(item).toBeTruthy();
    expect(item!.evidence.join(' ')).toMatch(/observed_crm|Note|Volume|période/i);
    expect(item!.interpretation).toMatch(/ne démontre pas la cause/i);
    expect(item!.limitations.join(' ')).toMatch(/réponse automatique|thématique|sentiment/i);
    expect(briefing.executionNote).toMatch(/consultatif|aucune campagne/i);
    expect(briefing.missingForBetterBriefing.join(' ')).not.toMatch(/Note avis moyenne \(hors/);
  });

  it('isolation : org-A ne porte pas org-B', () => {
    const a = buildMiProactiveBriefing(
      baseInsights({
        organizationId: 'org-p24-A',
        reviewsInsight: computeMiReviewsInsight({
          reviews: [row(2, '2026-10-05'), row(2, '2026-10-06'), row(2, '2026-10-07')],
          period: PERIOD,
          previousPeriod: PREV,
          timezone: TZ,
        }),
      }) as MiBriefingSource
    );
    const b = buildMiProactiveBriefing(
      baseInsights({
        organizationId: 'org-p24-B',
        reviewsInsight: null,
        clientCount: 0,
      }) as MiBriefingSource
    );
    expect(JSON.stringify(a)).not.toMatch(/org-p24-B/);
    expect(JSON.stringify(b)).not.toMatch(/2\.00\/5|Note avis moyenne = 2/);
  });
});
