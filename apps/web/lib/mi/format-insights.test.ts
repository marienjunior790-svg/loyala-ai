import { describe, expect, it } from 'vitest';
import { formatMiInsights } from './format-insights';

describe('formatMiInsights', () => {
  it('insufficient → empty, pas de stats inventées', () => {
    const out = formatMiInsights(
      {
        dataQuality: 'insufficient',
        limits: ['Aucune commande'],
        topClients: [
          {
            clientId: 'fake',
            displayName: 'Fake',
            phoneMasked: '***',
            spent: 999,
            visits: 9,
            averageBasket: 1,
            favoriteProduct: null,
          },
        ],
        kpis: { revenue: 1, visits: 1, averageBasket: 1, activeClients: 1 },
      },
      'insufficient'
    );
    expect(out.dataQuality).toBe('insufficient');
    expect(out.empty).toBe(true);
    expect(out.kpis).toBeNull();
    expect(out.topClients).toEqual([]);
    expect(out.limits).toContain('Aucune commande');
  });

  it('n’accepte que les lignes API valides (pas de démo)', () => {
    const out = formatMiInsights(
      {
        currency: 'XOF',
        topClients: [
          { displayName: 'incomplet' },
          {
            clientId: 'b',
            displayName: 'Bara',
            phoneMasked: '***01',
            spent: 27_000,
            visits: 2,
            averageBasket: 13_500,
            favoriteProduct: 'Thieb',
          },
        ],
        topProducts: [{ name: 'Thieb', quantity: 3, revenue: 15_000, clients: 2 }],
      },
      'ok'
    );
    expect(out.topClients).toHaveLength(1);
    expect(out.topClients[0]?.spent).toBe(27_000);
    expect(out.topProducts[0]?.name).toBe('Thieb');
    expect(out.empty).toBe(false);
  });

  it('payload vide → empty sans chiffres fictifs', () => {
    const out = formatMiInsights({}, 'ok');
    expect(out.empty).toBe(true);
    expect(out.kpis).toBeNull();
    expect(out.topClients).toEqual([]);
  });

  it('P3 : conserve campaignProposals même si insufficient', () => {
    const out = formatMiInsights(
      {
        limits: ['Aucune commande'],
        campaignProposals: [
          {
            id: 'campaign_nurture_at_risk',
            objectiveId: 'nurture_at_risk',
            campaignType: 'inactive',
            priority: 'low',
            objective: 'Nurture',
            analyticalJustification: ['n=1'],
            period: { code: 'mois', label: 'Mois', from: 'a', to: 'b' },
            targetingCriteria: 'at_risk',
            targetSegmentKey: 'at_risk',
            audienceHeadcount: 1,
            suggestedName: 'Retour',
            suggestedMessage: 'Hello',
            suggestedCta: 'Revenir',
            messageVariants: [],
            limits: ['Pas de ROI'],
            sourceRefs: ['retention:nurture_at_risk'],
          },
        ],
      },
      'insufficient'
    );
    expect(out.kpis).toBeNull();
    expect(out.campaignProposals).toHaveLength(1);
    expect(out.campaignProposals[0]?.audienceHeadcount).toBe(1);
    expect(out.empty).toBe(false);
  });

  it('P2 : conserve retention + customer intel même si insufficient', () => {
    const out = formatMiInsights(
      {
        limits: ['Aucune commande'],
        customerIntelligence: {
          metrics: [
            {
              id: 'period_spend',
              label: 'Dépenses',
              value: null,
              unit: 'money',
              source: 'kpis',
              periodScope: 'selected_period',
              inclusionRules: 'paid',
              limits: ['Non établi'],
              zeroMeans: '0 = aucune dépense',
            },
          ],
          segments: {
            counts: { inactive: 2, new: 1, regular: 0, vip: 0, at_risk: 0 },
            evolutionAvailable: false,
            evolutionNote: 'Pas de snapshots.',
          },
          medianRecencyDays: 10,
        },
        retentionStrategies: [
          {
            id: 'reactivate_inactive',
            ruleId: 'reactivate_inactive',
            priority: 'medium',
            segmentKey: 'inactive',
            headcount: 2,
            selectionCriteria: 'inactive',
            facts: ['n=2'],
            period: { code: 'mois', label: 'Mois', from: 'a', to: 'b' },
            marketingObjective: 'Réactiver',
            suggestedAction: 'Rappel',
            limits: ['Pas de ROI estimé'],
            confidence: 'medium',
          },
        ],
      },
      'insufficient'
    );
    expect(out.kpis).toBeNull();
    expect(out.empty).toBe(false);
    expect(out.retentionStrategies).toHaveLength(1);
    expect(out.customerIntelligence?.metrics[0]?.value).toBeNull();
    expect(out.customerIntelligence?.evolutionAvailable).toBe(false);
    expect(out.segments?.inactive).toBe(2);
  });

  it('mappe clientsServed CRM → activeClients affichage', () => {
    const out = formatMiInsights(
      {
        kpis: {
          revenue: 10_000,
          visits: 4,
          averageBasket: 2_500,
          clientsServed: 3,
          previousRevenue: 8_000,
        },
        trends: {
          revenue: { current: 10_000, previous: 8_000, changePct: 25, significant: true },
          visits: { current: 4, previous: 4, changePct: 0, significant: false },
          clientsServed: { current: 3, previous: 2, changePct: 50, significant: false },
          averageBasket: { current: 2_500, previous: 2_000, changePct: 25, significant: false },
          newClients: { current: 1, previous: 1, changePct: 0, significant: false },
          comparisonNote: 'note',
        },
        opportunities: [
          {
            id: 'revenue_rise_significant',
            ruleId: 'revenue_rise_significant',
            priority: 'low',
            facts: ['CA en hausse'],
            detectionRule: 'règle',
            period: { code: 'mois', label: 'Mois', from: 'a', to: 'b' },
            limits: ['limite'],
            suggestedAction: 'action',
          },
        ],
      },
      'ok'
    );
    expect(out.kpis?.activeClients).toBe(3);
    expect(out.kpis?.previousRevenue).toBe(8_000);
    expect(out.trends?.revenue.significant).toBe(true);
    expect(out.opportunities).toHaveLength(1);
    expect(out.opportunities[0]?.ruleId).toBe('revenue_rise_significant');
  });
});
