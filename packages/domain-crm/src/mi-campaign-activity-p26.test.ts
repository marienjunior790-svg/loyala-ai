/**
 * P2.6 — Activité campagnes / envois (fixtures synthétiques).
 */
import { describe, expect, it } from 'vitest';
import {
  computeMiCampaignActivityInsight,
  MI_CAMPAIGN_SEND_RATE_MIN,
  type MiCampaignActivityInsight,
} from './mi-campaign-activity';
import { deriveBomayeSignalsFromCrm } from './knowledge/bomaye-crm-bridge';
import { buildMiProactiveBriefing, type MiBriefingSource } from './mi-proactive-briefing';
import type { MiOrgInsights } from './mi-tools';

const TZ = 'Africa/Dakar';
const PERIOD = { from: '2026-10-01', to: '2026-10-18', label: 'Mois' };

function campaign(
  status: string,
  day: string,
  type = 'manual',
  targetCount = 10
) {
  return {
    type,
    status,
    target_count: targetCount,
    created_at: `${day}T12:00:00Z`,
    scheduled_at: null as string | null,
  };
}

function send(status: string, day: string, sentDay?: string) {
  return {
    status,
    created_at: `${day}T12:00:00Z`,
    sent_at: sentDay ? `${sentDay}T12:00:00Z` : status === 'sent' ? `${day}T12:00:00Z` : null,
  };
}

function baseInsights(partial: Partial<MiOrgInsights> = {}): MiOrgInsights {
  const p = {
    code: 'mois' as const,
    label: 'Mois',
    from: PERIOD.from,
    to: PERIOD.to,
    definition: 'synthétique P2.6',
  };
  const base: MiOrgInsights = {
    organizationId: 'org-p26-A',
    restaurantName: 'Resto P26',
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
    clientCount: 20,
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

describe('computeMiCampaignActivityInsight P2.6', () => {
  it('agrège volumes campagnes + envois sur la période', () => {
    const insight = computeMiCampaignActivityInsight({
      timezone: TZ,
      period: PERIOD,
      campaigns: [
        campaign('ready', '2026-10-05', 'inactive', 20),
        campaign('completed', '2026-10-10', 'birthday', 8),
        campaign('draft', '2026-09-20'), // hors période
      ],
      sends: [
        send('pending', '2026-10-06'),
        send('sent', '2026-10-07'),
        send('sent', '2026-10-08'),
        send('failed', '2026-10-09'),
        send('sent', '2026-09-15'), // hors période
      ],
    });
    expect(insight.campaignsInPeriod).toBe(2);
    expect(insight.sendsInPeriod).toBe(4);
    expect(insight.pendingCount).toBe(1);
    expect(insight.sentCount).toBe(2);
    expect(insight.failedCount).toBe(1);
    expect(insight.plannedTargetSum).toBe(28);
    expect(insight.limitations.join(' ')).toMatch(/ROI|ouverture|delivery/i);
  });

  it('absence totale → pas de taux inventé à 0', () => {
    const insight = computeMiCampaignActivityInsight({
      timezone: TZ,
      period: PERIOD,
      campaigns: [],
      sends: [],
    });
    expect(insight.markedSentRatePct).toBeNull();
    expect(insight.pendingSharePct).toBeNull();
    expect(insight.campaignsInPeriod).toBe(0);
  });

  it('volume sent+failed insuffisant → markedSentRatePct null', () => {
    const insight = computeMiCampaignActivityInsight({
      timezone: TZ,
      period: PERIOD,
      campaigns: [campaign('ready', '2026-10-05')],
      sends: [send('sent', '2026-10-06'), send('failed', '2026-10-07')],
    });
    expect(insight.sentCount + insight.failedCount).toBeLessThan(MI_CAMPAIGN_SEND_RATE_MIN);
    expect(insight.markedSentRatePct).toBeNull();
  });

  it('calcule markedSentRatePct quand volume suffisant', () => {
    const sends = [
      ...Array.from({ length: 4 }, () => send('sent', '2026-10-05')),
      ...Array.from({ length: 1 }, () => send('failed', '2026-10-06')),
    ];
    const insight = computeMiCampaignActivityInsight({
      timezone: TZ,
      period: PERIOD,
      campaigns: [campaign('completed', '2026-10-04')],
      sends,
    });
    expect(insight.markedSentRatePct).toBe(80);
    expect(insight.pendingSharePct).toBe(0);
  });

  it('ne prétend pas connaître opens / ROI', () => {
    const insight = computeMiCampaignActivityInsight({
      timezone: TZ,
      period: PERIOD,
      campaigns: [campaign('completed', '2026-10-04')],
      sends: Array.from({ length: 5 }, () => send('sent', '2026-10-05')),
    });
    const blob = JSON.stringify(insight);
    expect(blob).not.toMatch(/openRate|clickRate|roi\s*[:=]/i);
    expect(insight.limitations.join(' ')).toMatch(/pas un delivery|marquage CRM/i);
  });
});

describe('P2.6 bridge + briefing', () => {
  function activeInsight(): MiCampaignActivityInsight {
    return computeMiCampaignActivityInsight({
      timezone: TZ,
      period: PERIOD,
      campaigns: [
        campaign('ready', '2026-10-03', 'inactive'),
        campaign('failed', '2026-10-12', 'promotion'),
      ],
      sends: [
        ...Array.from({ length: 6 }, () => send('pending', '2026-10-05')),
        ...Array.from({ length: 4 }, () => send('sent', '2026-10-06')),
        send('failed', '2026-10-07'),
      ],
    });
  }

  it('bridge publie faits campagnes sans ROI numérique', () => {
    const bridge = deriveBomayeSignalsFromCrm(
      baseInsights({ campaignActivity: activeInsight() })
    );
    expect(bridge.facts.some((f) => /Campagnes période = 2/.test(f))).toBe(true);
    expect(bridge.facts.some((f) => /Envois période = 11/.test(f))).toBe(true);
    expect(bridge.facts.join(' ')).toMatch(/Taux marquage sent|Part pending/i);
    expect(bridge.limits.join(' ')).toMatch(/ROI/i);
    expect(JSON.stringify(bridge.signals)).not.toMatch(/roi/i);
  });

  it('briefing famille campaign_activity + no auto-send', () => {
    const briefing = buildMiProactiveBriefing(
      baseInsights({ campaignActivity: activeInsight() }) as MiBriefingSource
    );
    const item = briefing.items.find((i) => i.familyKey === 'campaign_activity');
    expect(item).toBeTruthy();
    expect(item!.evidence.join(' ')).toMatch(/observed_crm|pending|sent/i);
    expect(item!.interpretation).toMatch(/ROI|sent ≠/i);
    expect(briefing.executionNote).toMatch(/consultatif|aucune campagne/i);
    expect(briefing.missingForBetterBriefing.join(' ')).toMatch(/Opens|ROI/i);
  });

  it('campaignActivity null → limite explicite, pas 0 % inventé', () => {
    const bridge = deriveBomayeSignalsFromCrm(baseInsights({ campaignActivity: null }));
    expect(bridge.limits.join(' ')).toMatch(/campaignActivity absent|ROI/i);
  });

  it('isolation org-A / org-B', () => {
    const a = buildMiProactiveBriefing(
      baseInsights({
        organizationId: 'org-p26-A',
        campaignActivity: activeInsight(),
      }) as MiBriefingSource
    );
    const b = buildMiProactiveBriefing(
      baseInsights({
        organizationId: 'org-p26-B',
        campaignActivity: computeMiCampaignActivityInsight({
          timezone: TZ,
          period: PERIOD,
          campaigns: [],
          sends: [],
        }),
      }) as MiBriefingSource
    );
    expect(JSON.stringify(a)).not.toMatch(/org-p26-B/);
    expect(b.items.some((i) => /Aucune activité campagne/i.test(i.title))).toBe(true);
  });
});
