/**
 * P2.1 — Validation conversationnelle : CRM → Bomaye via runMiChatTurn.
 * Données synthétiques uniquement.
 */
import { describe, expect, it } from 'vitest';
import type { MiOrgInsights, MiOpportunity } from '@loyala/domain-crm';
import { detectMiIntent, runMiChatTurn } from './run-turn';

function period() {
  return {
    code: 'mois' as const,
    label: 'Mois',
    from: '2026-10-01',
    to: '2026-10-18',
    definition: 'synthétique P2.1',
  };
}

function synthInsights(orgId: string, partial: Partial<MiOrgInsights> = {}): MiOrgInsights {
  const p = period();
  const base: MiOrgInsights = {
    organizationId: orgId,
    restaurantName: 'Resto Synth P21 Chat',
    timezone: 'Africa/Dakar',
    currency: 'XOF',
    period: p,
    dataQuality: 'ok',
    limits: ['Données synthétiques P2.1.'],
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
  return { ...base, ...partial, organizationId: orgId };
}

function opp(ruleId: MiOpportunity['ruleId']): MiOpportunity {
  return {
    id: ruleId,
    ruleId,
    priority: 'high',
    facts: ['synth'],
    detectionRule: ruleId,
    period: { code: 'mois', label: 'Mois', from: '2026-10-01', to: '2026-10-18' },
    limits: [],
    suggestedAction: 'test',
    rankScore: 300,
  };
}

describe('P2.1 runMiChatTurn — pont CRM → Bomaye', () => {
  it('1 — baisse CA CRM significative sans % dans le message + réduction prix déclarée', async () => {
    const org = 'org-p21-s1';
    const insights = synthInsights(org, {
      trends: {
        revenue: { current: 700, previous: 1000, changePct: -30, significant: true },
        visits: { current: 35, previous: 40, changePct: -12.5, significant: false },
        clientsServed: { current: 30, previous: 34, changePct: -11.8, significant: false },
        averageBasket: { current: 20, previous: 25, changePct: -20, significant: true },
        newClients: { current: 4, previous: 5, changePct: -20, significant: false },
        comparisonNote: 'Comparaison synthétique.',
      },
      opportunities: [opp('revenue_drop_significant')],
    });
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: org,
      userId: 'u',
      message:
        'L’activité fléchit. On envisage une réduction générale des prix. Que recommandez-vous ?',
      loadInsights: async () => insights,
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    expect(turn.intent).toBe('knowledge');
    expect(turn.meta.skippedAi).toBe(true);
    expect(turn.toolsUsed).toContain('deriveBomayeSignalsFromCrm');
    const advisor = turn.insights.bomayeAdvisor as {
      dataOrigin: string;
      observedFacts: string[];
      fires: Array<{ ruleId: string }>;
      fieldOrigins?: Record<string, string>;
    };
    expect(advisor.dataOrigin).toBe('observed_crm');
    expect(advisor.observedFacts.join(' ')).toMatch(/-30|Variation CA/);
    expect(advisor.observedFacts.join(' ')).toMatch(/observed_crm/);
    expect(advisor.fires.some((f) => f.ruleId === 'CASE-PRICE-CUT')).toBe(true);
    expect(turn.answer).toMatch(/baisse générale|ne pas recommander|sentimier/i);
    expect(turn.answer).not.toMatch(/Food Cost\s*=\s*\d|ROI\s*=\s*\d|marge nette\s*=\s*\d/);
  });

  it('2 — baisse visites CRM significative sans % dans le message', async () => {
    const org = 'org-p21-s2';
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: org,
      userId: 'u',
      message: 'Baisse de fréquentation — que faire ? On pense à baisser les prix.',
      loadInsights: async () =>
        synthInsights(org, {
          trends: {
            revenue: { current: 800, previous: 820, changePct: -2.4, significant: false },
            visits: { current: 18, previous: 40, changePct: -55, significant: true },
            clientsServed: { current: 16, previous: 36, changePct: -55.6, significant: true },
            averageBasket: { current: 44, previous: 23, changePct: 91, significant: true },
            newClients: { current: 2, previous: 3, changePct: -33, significant: false },
            comparisonNote: 'note',
          },
          opportunities: [opp('visits_drop_significant')],
        }),
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    expect(turn.intent).toBe('knowledge');
    const facts = (turn.insights.bomayeAdvisor as { observedFacts: string[] }).observedFacts.join(
      ' '
    );
    expect(facts).toMatch(/-55|Variation visites/);
    expect(turn.answer).toMatch(/CASE-PRICE-CUT|baisse générale|leviers ciblés|sentimier/i);
  });

  it('3 — organisation sans client / historique insuffisant', async () => {
    const org = 'org-p21-empty';
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: org,
      userId: 'u',
      message: 'Aucune base de contacts — par où commencer la fidélisation ?',
      loadInsights: async () =>
        synthInsights(org, {
          clientCount: 0,
          dataQuality: 'insufficient',
          limits: ['Aucun client actif dans cette organisation.'],
          trends: null,
          opportunities: [],
        }),
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    const advisor = turn.insights.bomayeAdvisor as {
      observedFacts: string[];
      fires: Array<{ ruleId: string }>;
      crmBridge: { insufficientForTrends: boolean };
    };
    expect(advisor.crmBridge.insufficientForTrends).toBe(true);
    expect(advisor.fires.some((f) => f.ruleId === 'CASE-NO-CONTACTS')).toBe(true);
    expect(advisor.observedFacts.join(' ')).toMatch(/clientCount=0|Contacts.*= 0/);
    expect(turn.answer).not.toMatch(/Variation CA = 0 %/);
  });

  it('4 — données CRM partielles (trends null, partial)', async () => {
    const org = 'org-p21-partial';
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: org,
      userId: 'u',
      message: 'Food cost dépasse 32 %. Que faire ?',
      loadInsights: async () =>
        synthInsights(org, {
          clientCount: 8,
          dataQuality: 'partial',
          limits: ['Détail produits indisponible.'],
          trends: null,
        }),
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    const advisor = turn.insights.bomayeAdvisor as {
      crmBridge: { limits: string[]; insufficientForTrends: boolean };
      fires: Array<{ ruleId: string }>;
    };
    expect(advisor.crmBridge.insufficientForTrends).toBe(true);
    expect(advisor.crmBridge.limits.join(' ')).toMatch(/tendances|trends/i);
    expect(advisor.fires.some((f) => f.ruleId === 'REGLE-DEC-03')).toBe(true);
  });

  it('5 — contradiction déclaré vs observé (visites)', async () => {
    const org = 'org-p21-conflict';
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: org,
      userId: 'u',
      // Message déclare −10 % ; CRM a −50 %
      message:
        'Baisse de fréquentation de 10 %. On envisage une réduction générale des prix de 20 %.',
      loadInsights: async () =>
        synthInsights(org, {
          trends: {
            revenue: { current: 600, previous: 900, changePct: -33, significant: true },
            visits: { current: 20, previous: 40, changePct: -50, significant: true },
            clientsServed: { current: 18, previous: 36, changePct: -50, significant: true },
            averageBasket: { current: 30, previous: 25, changePct: 20, significant: true },
            newClients: { current: 2, previous: 4, changePct: -50, significant: false },
            comparisonNote: 'note',
          },
          opportunities: [opp('visits_drop_significant')],
        }),
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    const advisor = turn.insights.bomayeAdvisor as {
      conflicts: Array<{ field: string; observedValue: number; declaredValue: number }>;
      fieldOrigins: Record<string, string>;
    };
    expect(advisor.conflicts.some((c) => c.field === 'visitsChangePct')).toBe(true);
    expect(advisor.fieldOrigins.visitsChangePct).toBe('observed_crm');
    expect(turn.answer).toMatch(/Divergence|conserv/i);
    expect(turn.answer).toMatch(/-50|observed_crm/);
  });

  it('6 — provenance observed_crm / user_declared conservée', async () => {
    const org = 'org-p21-prov';
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: org,
      userId: 'u',
      message: 'Baisse de fréquentation. Réduction générale des prix envisagée.',
      loadInsights: async () =>
        synthInsights(org, {
          trends: {
            revenue: { current: 800, previous: 1000, changePct: -20, significant: true },
            visits: { current: 30, previous: 45, changePct: -33.3, significant: true },
            clientsServed: { current: 28, previous: 40, changePct: -30, significant: true },
            averageBasket: { current: 26, previous: 25, changePct: 4, significant: false },
            newClients: { current: 3, previous: 4, changePct: -25, significant: false },
            comparisonNote: 'note',
          },
          opportunities: [opp('revenue_drop_significant')],
        }),
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    const advisor = turn.insights.bomayeAdvisor as {
      dataOrigin: string;
      fieldOrigins: Record<string, string>;
    };
    expect(advisor.dataOrigin).toBe('observed_crm');
    expect(advisor.fieldOrigins.revenueChangePct).toBe('observed_crm');
    expect(advisor.fieldOrigins.consideringGeneralPriceCutPct).toBe('user_declared');
  });

  it('7 — n’invente pas Food Cost / marge / ROI', async () => {
    const org = 'org-p21-nofinance';
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: org,
      userId: 'u',
      message: 'Baisse de fréquentation, que recommandez-vous ?',
      loadInsights: async () =>
        synthInsights(org, {
          trends: {
            revenue: { current: 500, previous: 800, changePct: -37.5, significant: true },
            visits: { current: 22, previous: 40, changePct: -45, significant: true },
            clientsServed: { current: 20, previous: 35, changePct: -42.9, significant: true },
            averageBasket: { current: 22, previous: 23, changePct: -4.3, significant: false },
            newClients: { current: 2, previous: 5, changePct: -60, significant: true },
            comparisonNote: 'note',
          },
          opportunities: [opp('revenue_drop_significant'), opp('visits_drop_significant')],
        }),
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    expect(turn.answer).not.toMatch(/Food Cost\s*=\s*\d/);
    expect(turn.answer).not.toMatch(/marge nette\s*=\s*\d/);
    expect(turn.answer).not.toMatch(/ROI\s*=\s*\d/);
    expect(JSON.stringify(turn.insights.bomayeAdvisor)).not.toMatch(
      /"foodCostPct":\s*[1-9]/
    );
  });

  it('8 — isolation organisations', async () => {
    const turn = await runMiChatTurn({
      supabase: {} as never,
      organizationId: 'org-session-p21',
      userId: 'u',
      message: 'Baisse de fréquentation et réduction générale des prix ?',
      loadInsights: async () => synthInsights('org-other-p21'),
    });
    expect(turn.ok).toBe(false);
    if (!turn.ok) expect(turn.message).toMatch(/isolation/i);
  });

  it('10 — non-régression intents MI hors Bomaye', () => {
    expect(detectMiIntent('Quels sont mes meilleurs clients ?')).toBe('top_clients');
    expect(detectMiIntent('Quelles tendances vs période précédente ?')).toBe('trends');
    expect(detectMiIntent('Propose-moi une campagne de réactivation')).toBe('campaign');
    expect(detectMiIntent('Envoie un WhatsApp à mes VIP')).toBe('send_blocked');
  });
});
