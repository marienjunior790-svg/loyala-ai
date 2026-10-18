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
});
