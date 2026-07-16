import { describe, expect, it } from 'vitest';
import { formatClientInsights } from './insights';

describe('formatClientInsights', () => {
  it('returns empty string when no summary', () => {
    expect(formatClientInsights()).toBe('');
    expect(formatClientInsights(null)).toBe('');
  });

  it('builds a compact French summary', () => {
    const out = formatClientInsights({
      favoriteProduct: 'Burger',
      favoriteCategory: 'Plats',
      averageBasket: 3500,
      totalSpent: 45000,
      bestMonth: '2026-03',
      isVip: true,
    });
    expect(out).toContain('Produit préféré: Burger');
    expect(out).toContain('Catégorie préférée: Plats');
    expect(out).toContain('Panier moyen: 3500 FCFA');
    expect(out).toContain('Total dépensé: 45000 FCFA');
    expect(out).toContain('Client VIP');
  });

  it('omits missing or zero fields', () => {
    const out = formatClientInsights({ favoriteProduct: 'Coupe homme', averageBasket: 0 });
    expect(out).toBe('Produit préféré: Coupe homme');
  });
});
