import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { MiCockpit } from '../components/mi/mi-cockpit';

describe('MI P1 cockpit UI', () => {
  it('affiche données insuffisantes sans KPI inventés', () => {
    const html = renderToStaticMarkup(
      React.createElement(MiCockpit, {
        insights: { limits: ['Aucune commande payée'] },
        dataQuality: 'insufficient',
        period: {
          code: 'mois',
          label: 'Mois',
          from: '2026-10-01',
          to: '2026-10-18',
          definition: 'calendaire',
        },
        locale: 'fr',
      })
    );
    expect(html).toContain('mi-cockpit-insufficient');
    expect(html).toContain('Données insuffisantes');
    expect(html).not.toContain('mi-cockpit-kpis');
    expect(html).not.toContain('mi-cockpit-opportunities');
  });

  it('P2 : affiche fidélisation même si période insufficient', () => {
    const html = renderToStaticMarkup(
      React.createElement(MiCockpit, {
        insights: {
          limits: ['Aucune commande payée'],
          clientCount: 4,
          customerIntelligence: {
            metrics: [
              {
                id: 'median_recency_days',
                label: 'Récence médiane',
                value: 9,
                unit: 'days',
                source: 'last_visit_at',
                periodScope: 'point_in_time',
                inclusionRules: 'visit_count > 0',
                limits: [],
                zeroMeans: '0 j = visite aujourd’hui',
              },
              {
                id: 'period_spend',
                label: 'Dépenses cumulées',
                value: null,
                unit: 'money',
                source: 'kpis.revenue',
                periodScope: 'selected_period',
                inclusionRules: 'paid',
                limits: ['Non établi si insufficient'],
                zeroMeans: '0 = aucune dépense',
              },
            ],
            segments: {
              counts: { new: 1, regular: 1, vip: 0, inactive: 2, at_risk: 0 },
              evolutionAvailable: false,
              evolutionNote: 'Évolution historique des segments non disponible.',
            },
            medianRecencyDays: 9,
          },
          retentionStrategies: [
            {
              id: 'reactivate_inactive',
              ruleId: 'reactivate_inactive',
              priority: 'medium',
              segmentKey: 'inactive',
              headcount: 2,
              selectionCriteria: 'segment inactive',
              facts: ['Effectif : 2'],
              period: {
                code: 'mois',
                label: 'Mois',
                from: '2026-10-01',
                to: '2026-10-18',
              },
              marketingObjective: 'Réactiver',
              suggestedAction: 'Préparer un message de rappel',
              limits: ['Pas de ROI'],
              confidence: 'medium',
            },
          ],
        },
        dataQuality: 'insufficient',
        period: {
          code: 'mois',
          label: 'Mois',
          from: '2026-10-01',
          to: '2026-10-18',
          definition: 'calendaire',
        },
        locale: 'fr',
      })
    );
    expect(html).toContain('mi-cockpit-insufficient');
    expect(html).toContain('mi-cockpit-retention');
    expect(html).toContain('mi-cockpit-customer-intel');
    expect(html).toContain('reactivate_inactive');
    expect(html).toContain('Non établi');
    expect(html).not.toContain('mi-cockpit-kpis');
  });

  it('P3 : affiche propositions campagne + éditeur brouillon (sans persist)', () => {
    const html = renderToStaticMarkup(
      React.createElement(MiCockpit, {
        insights: {
          clientCount: 3,
          campaignProposals: [
            {
              id: 'campaign_thank_regular',
              objectiveId: 'thank_regular',
              campaignType: 'loyalty',
              priority: 'low',
              objective: 'Remercier',
              analyticalJustification: ['n=3'],
              period: {
                code: 'mois',
                label: 'Mois',
                from: '2026-10-01',
                to: '2026-10-18',
              },
              targetingCriteria: 'regular',
              targetSegmentKey: 'regular',
              audienceHeadcount: 3,
              suggestedName: 'Merci réguliers',
              suggestedMessage: 'Merci !',
              suggestedCta: 'À bientôt',
              messageVariants: ['Variante'],
              limits: ['Brouillon'],
              sourceRefs: ['retention:thank_regular'],
            },
          ],
        },
        dataQuality: 'ok',
        period: {
          code: 'mois',
          label: 'Mois',
          from: '2026-10-01',
          to: '2026-10-18',
          definition: 'calendaire',
        },
        locale: 'fr',
      })
    );
    expect(html).toContain('mi-campaign-proposals');
    expect(html).toContain('thank_regular');
    expect(html).toContain('Préparer le brouillon');
    expect(html).not.toMatch(/createCampaign|sendWhatsApp/i);
  });

  it('affiche KPI + tendances + opportunités depuis payload CRM', () => {
    const html = renderToStaticMarkup(
      React.createElement(MiCockpit, {
        insights: {
          currency: 'XOF',
          restaurantName: 'Chez Test',
          kpis: {
            revenue: 50_000,
            visits: 10,
            averageBasket: 5_000,
            clientsServed: 4,
            previousRevenue: 80_000,
            previousVisits: 12,
            previousAverageBasket: 6_000,
            previousClientsServed: 5,
          },
          trends: {
            revenue: { current: 50_000, previous: 80_000, changePct: -38, significant: true },
            visits: { current: 10, previous: 12, changePct: -17, significant: false },
            clientsServed: { current: 4, previous: 5, changePct: -20, significant: true },
            averageBasket: { current: 5_000, previous: 6_000, changePct: -17, significant: false },
            newClients: { current: 0, previous: 3, changePct: -100, significant: true },
            comparisonNote: 'Comparaison vs période précédente du dashboard.',
          },
          opportunities: [
            {
              id: 'revenue_drop_significant',
              ruleId: 'revenue_drop_significant',
              priority: 'high',
              facts: ['CA en baisse'],
              detectionRule: 'Baisse ≥ 20 %',
              period: {
                code: 'mois',
                label: 'Mois',
                from: '2026-10-01',
                to: '2026-10-18',
              },
              limits: ['Pas de causalité'],
              suggestedAction: 'Analyser les top clients',
            },
          ],
        },
        dataQuality: 'ok',
        period: {
          code: 'mois',
          label: 'Mois',
          from: '2026-10-01',
          to: '2026-10-18',
          definition: 'calendaire',
        },
        locale: 'fr',
      })
    );
    expect(html).toContain('mi-cockpit-kpis');
    expect(html).toContain('mi-cockpit-opportunities');
    expect(html).toContain('revenue_drop_significant');
    expect(html).toContain('significative');
    expect(html).toContain('Chez Test');
  });

  it('page charge le snapshot serveur (lecture seule)', () => {
    const src = readFileSync(
      resolve(__dirname, '../app/(dashboard)/marketing-intelligence/page.tsx'),
      'utf8'
    );
    expect(src).toContain('loadMiOrgInsights');
    expect(src).toContain('miInsightsForPrompt');
    expect(src).not.toMatch(/createCampaign|sendWhatsApp|service_role/i);
  });

  it('responsive cockpit + client', () => {
    const cockpit = readFileSync(resolve(__dirname, '../components/mi/mi-cockpit.tsx'), 'utf8');
    expect(cockpit).toMatch(/sm:grid-cols-2|xl:grid-cols-4|lg:grid-cols-2/);
    expect(cockpit).toContain('aria-label');
    expect(cockpit).toContain('aria-busy');
  });
});
