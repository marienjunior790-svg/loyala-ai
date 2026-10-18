import { describe, expect, it, vi } from 'vitest';
import type { MiOrgInsights } from '@loyala/domain-crm';
import { detectMiIntent, runMiChatTurn, type MiOrchestrateFn } from './run-turn';

function insights(partial: Partial<MiOrgInsights> & Pick<MiOrgInsights, 'dataQuality'>): MiOrgInsights {
  return {
    organizationId: 'org-a',
    restaurantName: 'Chez Test',
    timezone: 'Africa/Dakar',
    currency: 'XOF',
    period: {
      code: 'mois',
      label: 'Mois',
      from: '2026-10-01',
      to: '2026-10-14',
      definition: 'test',
    },
    dataQuality: partial.dataQuality,
    limits: partial.limits ?? [],
    kpis: partial.kpis ?? null,
    topClients: partial.topClients ?? [],
    topProducts: partial.topProducts ?? [],
    topCategories: partial.topCategories ?? [],
    segments: partial.segments ?? null,
    inactiveLoyal: partial.inactiveLoyal ?? [],
    clientCount: partial.clientCount ?? 0,
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
