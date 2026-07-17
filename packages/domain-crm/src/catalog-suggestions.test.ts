import { describe, expect, it } from 'vitest';
import { suggestVariants, hasSuggestions } from './catalog-suggestions';

describe('catalog-suggestions', () => {
  it('suggests sizes for pizza', () => {
    const groups = suggestVariants('Pizza Margherita', 'Pizzas');
    expect(groups.some((g) => g.name === 'Taille')).toBe(true);
  });

  it('suggests cooking for burger', () => {
    const groups = suggestVariants('Double Cheeseburger');
    expect(groups.some((g) => g.kind === 'cooking')).toBe(true);
  });

  it('suggests size + milk for coffee', () => {
    const groups = suggestVariants('Cappuccino');
    expect(groups.some((g) => g.name === 'Taille')).toBe(true);
    expect(groups.some((g) => g.name === 'Lait')).toBe(true);
  });

  it('returns empty for unknown products', () => {
    expect(suggestVariants('Vis inox M6')).toEqual([]);
    expect(hasSuggestions('Vis inox M6')).toBe(false);
  });

  it('generates unique ids per group and choice', () => {
    const groups = suggestVariants('Pizza');
    const ids = new Set(groups.map((g) => g.id));
    expect(ids.size).toBe(groups.length);
    for (const g of groups) {
      expect(g.choices.length).toBeGreaterThan(0);
    }
  });
});
