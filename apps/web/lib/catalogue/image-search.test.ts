import { describe, expect, it } from 'vitest';
import {
  buildImageSearchQueries,
  categoryToEnglish,
  dishNameToEnglish,
} from './image-search';

describe('dishNameToEnglish', () => {
  it('translates beignets de crevettes', () => {
    expect(dishNameToEnglish('Beignets de crevettes')).toContain('fritters');
    expect(dishNameToEnglish('Beignets de crevettes')).toContain('shrimp');
  });
});

describe('categoryToEnglish', () => {
  it('maps Entrées to appetizer', () => {
    expect(categoryToEnglish('Entrées')).toBe('appetizer');
  });
});

describe('buildImageSearchQueries', () => {
  it('puts English food query first for FR dishes', () => {
    const qs = buildImageSearchQueries({
      name: 'Beignets de crevettes',
      category: 'Entrées',
    });
    expect(qs[0]?.toLowerCase()).toMatch(/shrimp|fritter/);
    expect(qs[0]?.toLowerCase()).toContain('food');
    expect(qs.some((q) => /beignets/i.test(q))).toBe(true);
  });
});
