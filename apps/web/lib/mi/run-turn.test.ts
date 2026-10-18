import { describe, expect, it, vi } from 'vitest';
import type { MiOrgInsights } from '@loyala/domain-crm';
import { detectMiIntent, runMiChatTurn, type MiOrchestrateFn } from './run-turn';

function emptyCustomerIntelligence(
  period: MiOrgInsights['period'],
  dataQuality: MiOrgInsights['dataQuality']
): MiOrgInsights['customerIntelligence'] {
  return {
    period: {
      code: period.code,
      label: period.label,
      from: period.from,
      to: period.to,
      definition: period.definition,
    },
    dataQuality,
    metrics: [],
    segments: null,
    medianRecencyDays: null,
  };
}

function insights(partial: Partial<MiOrgInsights> & Pick<MiOrgInsights, 'dataQuality'>): MiOrgInsights {
  const period = partial.period ?? {
    code: 'mois' as const,
    label: 'Mois',
    from: '2026-10-01',
    to: '2026-10-14',
    definition: 'test',
  };
  return {
    organizationId: 'org-a',
    restaurantName: 'Chez Test',
    timezone: 'Africa/Dakar',
    currency: 'XOF',
    period,
    dataQuality: partial.dataQuality,
    limits: partial.limits ?? [],
    kpis: partial.kpis ?? null,
    topClients: partial.topClients ?? [],
    topProducts: partial.topProducts ?? [],
    topCategories: partial.topCategories ?? [],
    segments: partial.segments ?? null,
    inactiveLoyal: partial.inactiveLoyal ?? [],
    clientCount: partial.clientCount ?? 0,
    trends: partial.trends ?? null,
    opportunities: partial.opportunities ?? [],
    customerIntelligence:
      partial.customerIntelligence ?? emptyCustomerIntelligence(period, partial.dataQuality),
    retentionStrategies: partial.retentionStrategies ?? [],
    ...partial,
  };
}

describe('detectMiIntent', () => {
  it('détecte top clients / produits / inactifs', () => {
    expect(detectMiIntent('Quels sont mes meilleurs clients sur 30 jours ?')).toBe('top_clients');
    expect(detectMiIntent('Quels sont les plats les plus vendus ?')).toBe('top_products');
    expect(detectMiIntent('Qui sont les clients inactifs à relancer ?')).toBe('inactive');
  });

  it('bloque les demandes d’envoi sans ambiguïté', () => {
    expect(detectMiIntent('Envoie un WhatsApp à mes VIP')).toBe('send_blocked');
    expect(detectMiIntent('Lance la campagne promo')).toBe('send_blocked');
    expect(detectMiIntent('Publie sur WhatsApp')).toBe('send_blocked');
  });

  it('détecte tendances et opportunités P1', () => {
    expect(detectMiIntent('Quelles sont les tendances par rapport à la période précédente ?')).toBe(
      'trends'
    );
    expect(detectMiIntent('Quelles opportunités prioritaires vois-tu ?')).toBe('opportunities');
  });

  it('détecte fidélisation P2', () => {
    expect(detectMiIntent('Quels clients dois-je fidéliser en priorité ?')).toBe('retention');
    expect(detectMiIntent('Comment encourager mes nouveaux clients à revenir ?')).toBe('retention');
    expect(detectMiIntent('Quels segments méritent une action cette semaine ?')).toBe('retention');
  });
});

describe('runMiChatTurn', () => {
  const supabase = {} as never;

  it('refuse l’envoi sans appeler l’IA ni les outils CRM', async () => {
    const loadInsights = vi.fn();
    const orchestrate = vi.fn() as unknown as MiOrchestrateFn;

    const result = await runMiChatTurn({
      supabase,
      organizationId: 'org-a',
      userId: 'user-1',
      message: 'Envoie un WhatsApp maintenant',
      loadInsights,
      orchestrate,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent).toBe('send_blocked');
    expect(result.meta.skippedAi).toBe(true);
    expect(result.toolsUsed).toEqual([]);
    expect(result.answer.toLowerCase()).toMatch(/ne peux pas envoyer|consultatif/);
    expect(loadInsights).not.toHaveBeenCalled();
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it('dataQuality insufficient → pas d’IA, pas de stats inventées', async () => {
    const loadInsights = vi.fn(async () =>
      insights({
        dataQuality: 'insufficient',
        limits: ['Aucune commande payée sur la période'],
        clientCount: 2,
        topClients: [],
      })
    );
    const orchestrate = vi.fn() as unknown as MiOrchestrateFn;

    const result = await runMiChatTurn({
      supabase,
      organizationId: 'org-a',
      userId: 'user-1',
      message: 'Meilleurs clients du mois',
      loadInsights,
      orchestrate,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataQuality).toBe('insufficient');
    expect(result.meta.skippedAi).toBe(true);
    expect(result.insights.topClients).toEqual([]);
    expect(result.answer).toContain('insufficient');
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it('ne lit jamais une autre organisation que celle de session', async () => {
    const loadInsights = vi.fn(async () =>
      insights({
        organizationId: 'org-other',
        dataQuality: 'ok',
        clientCount: 5,
        topClients: [
          {
            clientId: 'x',
            displayName: 'Leak',
            phoneMasked: '***99',
            spent: 1,
            visits: 1,
            averageBasket: 1,
            favoriteProduct: null,
          },
        ],
      })
    );

    const result = await runMiChatTurn({
      supabase,
      organizationId: 'org-a',
      userId: 'user-1',
      message: 'Meilleurs clients',
      loadInsights,
      orchestrate: vi.fn() as unknown as MiOrchestrateFn,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('data_error');
    expect(result.message).toMatch(/Isolation/);
  });

  it('trends → réponse déterministe sans IA', async () => {
    const loadInsights = vi.fn(async () =>
      insights({
        dataQuality: 'ok',
        clientCount: 3,
        trends: {
          revenue: { current: 80_000, previous: 100_000, changePct: -20, significant: true },
          visits: { current: 10, previous: 12, changePct: -17, significant: false },
          clientsServed: { current: 8, previous: 9, changePct: -11, significant: false },
          averageBasket: { current: 8_000, previous: 8_333, changePct: -4, significant: false },
          newClients: { current: 1, previous: 2, changePct: -50, significant: false },
          comparisonNote: 'Comparaison vs période précédente.',
        },
      })
    );
    const orchestrate = vi.fn() as unknown as MiOrchestrateFn;
    const result = await runMiChatTurn({
      supabase,
      organizationId: 'org-a',
      userId: 'user-1',
      message: 'Quelles sont les tendances par rapport à la période précédente ?',
      loadInsights,
      orchestrate,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent).toBe('trends');
    expect(result.meta.skippedAi).toBe(true);
    expect(result.answer).toContain('Tendances');
    expect(result.answer).toContain('-20');
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it('grounded : passe toolResults réels à orchestrateAI', async () => {
    const loadInsights = vi.fn(async () =>
      insights({
        dataQuality: 'ok',
        clientCount: 3,
        topClients: [
          {
            clientId: 'b',
            displayName: 'Bara',
            phoneMasked: '***01',
            spent: 27_000,
            visits: 2,
            averageBasket: 13_500,
            favoriteProduct: 'Thieboudienne',
          },
        ],
      })
    );
    const orchestrate = vi.fn(async () => ({
      requestId: 'req-1',
      content: 'Bara est votre meilleur client avec 27000 XOF.',
      model: 'mock',
      provider: 'mock' as const,
      usage: { inputTokens: 10, outputTokens: 20, costUsd: 0 },
      cached: false,
      latencyMs: 12,
    }));

    const result = await runMiChatTurn({
      supabase,
      organizationId: 'org-a',
      userId: 'user-1',
      message: 'Qui sont mes meilleurs clients sur 30 jours ?',
      loadInsights,
      orchestrate,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent).toBe('top_clients');
    expect(result.toolsUsed).toContain('listTopClientsFromDashboard');
    expect(orchestrate).toHaveBeenCalledOnce();
    const call = orchestrate.mock.calls[0]?.[0];
    expect(call?.tenantId).toBe('org-a');
    expect(call?.promptKey).toBe('marketing.assistant.answer');
    expect(String(call?.variables.toolResults)).toContain('Bara');
    expect(String(call?.variables.toolResults)).toContain('27000');
    expect(result.answer).toContain('Bara');
  });

  it('retention → réponse déterministe même si période insufficient', async () => {
    const loadInsights = vi.fn(async () =>
      insights({
        dataQuality: 'insufficient',
        limits: ['Aucune commande payée sur la période'],
        clientCount: 6,
        segments: { new: 1, regular: 2, vip: 0, inactive: 2, at_risk: 1 },
        customerIntelligence: {
          period: {
            code: 'mois',
            label: 'Mois',
            from: '2026-10-01',
            to: '2026-10-14',
            definition: 'test',
          },
          dataQuality: 'insufficient',
          metrics: [],
          segments: {
            counts: { new: 1, regular: 2, vip: 0, inactive: 2, at_risk: 1 },
            source: 'computeClientSegment',
            asOf: 'point_in_time_now',
            evolutionAvailable: false,
            evolutionNote: 'Évolution historique des segments non disponible.',
          },
          medianRecencyDays: 12,
        },
        retentionStrategies: [
          {
            id: 'reactivate_inactive',
            ruleId: 'reactivate_inactive',
            priority: 'medium',
            segmentKey: 'inactive',
            headcount: 2,
            selectionCriteria: 'computeClientSegment = inactive',
            facts: ['Effectif segment inactive : 2'],
            period: { code: 'mois', label: 'Mois', from: '2026-10-01', to: '2026-10-14' },
            marketingObjective: 'Réactiver',
            suggestedAction: 'Préparer un message de rappel',
            limits: ['Pas de ROI inventé'],
            confidence: 'medium',
            rankScore: 220,
          },
        ],
      })
    );
    const orchestrate = vi.fn() as unknown as MiOrchestrateFn;
    const result = await runMiChatTurn({
      supabase,
      organizationId: 'org-a',
      userId: 'user-1',
      message: 'Quels clients dois-je fidéliser en priorité ?',
      loadInsights,
      orchestrate,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent).toBe('retention');
    expect(result.meta.skippedAi).toBe(true);
    expect(result.toolsUsed).toContain('buildMiRetentionStrategies');
    expect(result.answer).toContain('fidélisation');
    expect(result.answer).toContain('reactivate_inactive');
    expect(result.answer.toLowerCase()).not.toMatch(/roi de|conversion garantie|%\s*de retour/);
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it('mappe quota / timeout IA en erreurs typées', async () => {
    const loadInsights = vi.fn(async () =>
      insights({ dataQuality: 'ok', clientCount: 1, topClients: [] })
    );

    const quota = await runMiChatTurn({
      supabase,
      organizationId: 'org-a',
      userId: 'u',
      message: 'Résumé KPI',
      loadInsights,
      orchestrate: async () => {
        throw new Error('Cost $1.00 exceeds limit');
      },
    });
    expect(quota.ok).toBe(false);
    if (!quota.ok) expect(quota.code).toBe('ai_quota');

    const timeout = await runMiChatTurn({
      supabase,
      organizationId: 'org-a',
      userId: 'u',
      message: 'Résumé KPI',
      loadInsights,
      orchestrate: async () => {
        throw new Error('Request timeout');
      },
    });
    expect(timeout.ok).toBe(false);
    if (!timeout.ok) expect(timeout.code).toBe('ai_timeout');
  });
});
