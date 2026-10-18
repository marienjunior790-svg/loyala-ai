import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { MiInsightsPanel, MiPeriodChip } from '../components/mi/mi-insights-panel';
import { miHttpErrorMessage, suggestionsFor, MI_PERIODS } from '../lib/mi/ui-copy';
import { hasPermission } from '@loyala/core-iam';

const miRoot = resolve(__dirname, '../components/mi');
const pagePath = resolve(__dirname, '../app/(dashboard)/marketing-intelligence/page.tsx');

describe('MI L3 UI — contrats & accessibilité structurelle', () => {
  it('page exige analytics:read', () => {
    const src = readFileSync(pagePath, 'utf8');
    expect(src).toContain("requireAuthPermission('analytics:read')");
    expect(src).toContain('MarketingIntelligenceClient');
  });

  it('périodes UI = contrat backend', () => {
    expect(MI_PERIODS.map((p) => p.value)).toEqual(['semaine', 'mois', '3mois', 'annee']);
  });

  it('suggestions FR/EN non vides, sans chiffres de démo restaurant', () => {
    for (const s of [...suggestionsFor('fr'), ...suggestionsFor('en')]) {
      expect(s.length).toBeGreaterThan(10);
      expect(s).not.toMatch(/\b27[\s_]?000\b/);
      expect(s).not.toMatch(/Bara|Chez Test/i);
    }
  });

  it('messages 401/403 compréhensibles', () => {
    expect(miHttpErrorMessage(401, 'unauthorized', null, 'fr')).toMatch(/Session|Reconnect/i);
    expect(miHttpErrorMessage(403, 'forbidden', null, 'fr')).toMatch(/analytics:read/);
    expect(miHttpErrorMessage(403, 'forbidden', null, 'en')).toMatch(/analytics:read/);
  });

  it('staff sans analytics:read (aligné API)', () => {
    expect(
      hasPermission({ userId: 'u', organizationId: 'o', role: 'org_staff' }, 'analytics:read')
    ).toBe(false);
    expect(
      hasPermission({ userId: 'u', organizationId: 'o', role: 'org_viewer' }, 'analytics:read')
    ).toBe(true);
  });

  it('rendu insights : période API + insufficient sans KPI', () => {
    const insufficient = renderToStaticMarkup(
      React.createElement(MiInsightsPanel, {
        insights: { limits: ['Aucune commande'], topClients: [] },
        dataQuality: 'insufficient',
        period: {
          code: 'mois',
          label: 'Mois',
          from: '2026-10-01',
          to: '2026-10-14',
          definition: 'Du 1er du mois',
        },
        locale: 'fr',
        toolsUsed: ['loadMiOrgInsights'],
      })
    );
    expect(insufficient).toContain('mi-insufficient');
    expect(insufficient).toContain('2026-10-01');
    expect(insufficient).toContain('Données insuffisantes');
    expect(insufficient).not.toContain('mi-kpis');
    expect(insufficient).not.toContain('mi-top-clients');

    const ok = renderToStaticMarkup(
      React.createElement(MiInsightsPanel, {
        insights: {
          currency: 'XOF',
          kpis: { revenue: 50_000, visits: 10, averageBasket: 5_000, activeClients: 4 },
          topClients: [
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
        },
        dataQuality: 'ok',
        period: {
          code: 'mois',
          label: 'Mois',
          from: '2026-10-01',
          to: '2026-10-14',
          definition: 'calendaire',
        },
        locale: 'fr',
      })
    );
    expect(ok).toContain('mi-kpis');
    expect(ok).toContain('Bara');
    expect(ok).toMatch(/27[\s\u00a0\u202f]?000/);
  });

  it('MiPeriodChip expose la période exacte backend', () => {
    const html = renderToStaticMarkup(
      React.createElement(MiPeriodChip, {
        period: {
          code: '3mois',
          label: '3 mois',
          from: '2026-08-01',
          to: '2026-10-14',
          definition: 'test def',
        },
        locale: 'fr',
      })
    );
    expect(html).toContain('2026-08-01');
    expect(html).toContain('3 mois');
    expect(html).toContain('test def');
  });

  it('sources UI : pas d’effets externes / pas de persistence', () => {
    const files = [
      resolve(miRoot, 'marketing-intelligence-client.tsx'),
      resolve(miRoot, 'mi-insights-panel.tsx'),
      pagePath,
    ];
    const forbidden = [
      /sendWhatsApp|launchCampaign|createCampaign|scheduleCampaign/i,
      /\.from\(\s*['"]campaigns['"]\s*\)/i,
      /createAdminClient\s*\(/,
      /localStorage|sessionStorage|indexedDB/i,
      /\/api\/(?!mi\/chat)/i,
    ];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const re of forbidden) {
        expect(src, `${file} × ${re}`).not.toMatch(re);
      }
      // Pas de CTA d’exécution campagne / WhatsApp
      expect(src).not.toMatch(/>\s*(Envoyer|Lancer|Publier)\s*</);
      expect(src).not.toMatch(/WhatsApp Cloud/i);
    }
    const client = readFileSync(resolve(miRoot, 'marketing-intelligence-client.tsx'), 'utf8');
    expect(client).toContain('postMiChat');
    expect(readFileSync(resolve(__dirname, '../lib/mi/api-client.ts'), 'utf8')).toContain(
      '/api/mi/chat'
    );
    expect(client).toMatch(/aria-live/);
    expect(client).toMatch(/aria-busy/);
    expect(client).toMatch(/Nouvelle conversation|New conversation/);
  });

  it('responsive : classes mobile/desktop présentes', () => {
    const src = readFileSync(resolve(miRoot, 'marketing-intelligence-client.tsx'), 'utf8');
    expect(src).toMatch(/sm:/);
    expect(src).toMatch(/lg:/);
    expect(src).toMatch(/min-h-\[calc\(100dvh/);
  });
});
