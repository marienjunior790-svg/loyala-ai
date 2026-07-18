import { describe, expect, it } from 'vitest';
import { formatMenuContextForPrompt, type MenuContextSnapshot } from './menu-context';

function snapshot(partial?: Partial<MenuContextSnapshot>): MenuContextSnapshot {
  return {
    organization: {
      name: 'Chez Amadou',
      currency: 'XOF',
      country: 'SN',
      timezone: 'Africa/Dakar',
      establishmentType: 'Restaurant',
    },
    season: {
      season: 'été',
      month: 7,
      upcomingEvents: [],
    },
    catalog: {
      categories: [
        { name: 'Pizzas', itemCount: 2 },
        { name: 'Boissons', itemCount: 1 },
      ],
      items: [
        {
          name: 'Margherita',
          category: 'Pizzas',
          type: 'product',
          price: 3500,
          hasPhoto: true,
          hasOptions: false,
          active: true,
        },
        {
          name: 'Coca',
          category: 'Boissons',
          type: 'product',
          price: 500,
          hasPhoto: false,
          hasOptions: false,
          active: true,
        },
      ],
      qualityScore: 72,
      withoutImage: 1,
      incomplete: 0,
    },
    sales: {
      topProducts: [{ name: 'Margherita', clientCount: 12 }],
      topCategories: [{ name: 'Pizzas', clientCount: 20 }],
      affinityClients: 40,
    },
    crm: {
      segments: { new: 5, regular: 10, vip: 2, inactive: 3, at_risk: 1 },
      totalClients: 21,
      loyaltyMembers: 8,
      loyaltyPointsIssued: 1200,
    },
    request: {
      goal: 'panier_moyen',
      menuKind: 'midi',
      dietary: ['halal'],
      brief: 'Focus déjeuner bureau',
      mode: 'advanced',
    },
    generatedAt: '2026-07-17T12:00:00.000Z',
    ...partial,
  };
}

describe('formatMenuContextForPrompt', () => {
  it('includes establishment, goal, catalog and CRM signals', () => {
    const text = formatMenuContextForPrompt(snapshot());
    expect(text).toContain('Chez Amadou');
    expect(text).toContain('Restaurant');
    expect(text).toContain('Objectif: panier_moyen');
    expect(text).toContain('Type de menu: midi');
    expect(text).toContain('halal');
    expect(text).toContain('Focus déjeuner bureau');
    expect(text).toContain('Margherita');
    expect(text).toContain('Top produits');
    expect(text).toContain('VIP 2');
    expect(text).toContain('ne propose QUE des produits actifs');
  });

  it('handles empty sales and dietary gracefully', () => {
    const text = formatMenuContextForPrompt(
      snapshot({
        sales: { topProducts: [], topCategories: [], affinityClients: 0 },
        request: { goal: 'general', menuKind: 'jour', dietary: [], mode: 'quick' },
      })
    );
    expect(text).toContain('Contraintes: aucune');
    expect(text).not.toContain('Top produits');
  });
});
