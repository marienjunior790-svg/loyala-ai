/**
 * Intégration chat MI ↔ pack Bomaye — données synthétiques uniquement.
 */
import { describe, expect, it, vi } from 'vitest';
import type { MiOrgInsights } from '@loyala/domain-crm';
import { detectMiIntent, runMiChatTurn } from './run-turn';

function emptyInsights(orgId: string): MiOrgInsights {
  return {
    organizationId: orgId,
    restaurantName: 'Resto Synthétique Test',
    timezone: 'Africa/Brazzaville',
    currency: 'XAF',
    period: {
      code: 'mois',
      label: 'Mois',
      from: '2026-10-01',
      to: '2026-10-18',
      definition: 'test',
    },
    dataQuality: 'partial',
    limits: ['Données synthétiques de test — pas un restaurant réel.'],
    kpis: null,
    topClients: [],
    topProducts: [],
    topCategories: [],
    segments: null,
    inactiveLoyal: [],
    clientCount: 0,
    trends: null,
    opportunities: [],
    customerIntelligence: {
      period: {
        code: 'mois',
        label: 'Mois',
        from: '2026-10-01',
        to: '2026-10-18',
        definition: 'test',
      },
      dataQuality: 'partial',
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
}

describe('runMiChatTurn — Bomaye knowledge path', () => {
  it('détecte intent knowledge sur baisse fréquentation + prix', () => {
    expect(
      detectMiIntent(
        'On a une baisse de fréquentation de 15% et on envisage une réduction générale des prix de 20%'
      )
    ).toBe('knowledge');
  });

  it('Test 1 via chat — refuse baisse générale des prix', async () => {
    const orgA = 'org-synth-a';
    const loadInsights = vi.fn(async () => emptyInsights(orgA));
    const result = await runMiChatTurn({
      supabase: {} as never,
      organizationId: orgA,
      userId: 'user-synth',
      message:
        'Baisse de fréquentation de 15%. On envisage une réduction générale des prix de 20%. Que faire ?',
      loadInsights,
      bomayeSignals: {
        dataOrigin: 'synthetic_test',
        visitsChangePct: -15,
        consideringGeneralPriceCutPct: 20,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent).toBe('knowledge');
    expect(result.meta.skippedAi).toBe(true);
    expect(result.answer).toMatch(/baisse générale|ne pas recommander/i);
    expect(result.insights.bomayeAdvisor).toBeTruthy();
  });

  it('Test 7 via chat — Brazzaville WhatsApp / Mobile Money', async () => {
    const orgA = 'org-synth-brazzaville';
    const result = await runMiChatTurn({
      supabase: {} as never,
      organizationId: orgA,
      userId: 'user-synth',
      message:
        'Restaurant à Brazzaville : on utilise WhatsApp, les espèces et le Mobile Money. Quelles recommandations ?',
      loadInsights: async () => emptyInsights(orgA),
      bomayeSignals: {
        dataOrigin: 'synthetic_test',
        marketContext: 'africa',
        channels: ['whatsapp', 'cash', 'mobile_money'],
        clientContactCount: 0,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toMatch(/whatsapp/i);
    expect(result.answer).toMatch(/mobile money|cash|uber eats/i);
  });

  it('Test 8 via chat — diagnostic financier sans chiffres', async () => {
    const orgA = 'org-synth-finance';
    const result = await runMiChatTurn({
      supabase: {} as never,
      organizationId: orgA,
      userId: 'user-synth',
      message: 'Fais-moi un diagnostic financier complet de mon restaurant.',
      loadInsights: async () => emptyInsights(orgA),
      bomayeSignals: {
        dataOrigin: 'synthetic_test',
        financialDiagnosisRequested: true,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toMatch(/manquant|insuffisant|inventé/i);
  });

  it('Test 10 — isolation organisations (snapshot org ≠ session → erreur)', async () => {
    const result = await runMiChatTurn({
      supabase: {} as never,
      organizationId: 'org-session',
      userId: 'user-synth',
      message: 'Food cost dépasse 32%, que faire ?',
      loadInsights: async () => emptyInsights('org-other'),
      bomayeSignals: { dataOrigin: 'synthetic_test', foodCostPct: 35 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('data_error');
    expect(result.message).toMatch(/isolation/i);
  });

  it('ne croise pas les knowledgeRefs privés entre orgs (payload lié à l’org session)', async () => {
    const orgA = 'org-a-only';
    const result = await runMiChatTurn({
      supabase: {} as never,
      organizationId: orgA,
      userId: 'u',
      message: 'Food cost dépasse 32%.',
      loadInsights: async () => emptyInsights(orgA),
      bomayeSignals: { dataOrigin: 'synthetic_test', foodCostPct: 35 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Pack Bomaye = référentiel partagé (public métier), pas des données clients d’une autre org.
    expect(result.insights.restaurantName).toBe('Resto Synthétique Test');
    // P2.1 : dès que le pont CRM contribue, dataOrigin global = observed_crm
    // (les overrides tests restent traçables via fieldOrigins / conflicts).
    expect((result.insights.bomayeAdvisor as { dataOrigin: string }).dataOrigin).toBe(
      'observed_crm'
    );
  });
});
