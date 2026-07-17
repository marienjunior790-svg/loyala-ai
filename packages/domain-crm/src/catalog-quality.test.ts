import { describe, expect, it } from 'vitest';
import { computeCatalogQuality } from './catalog-quality';
import type { CatalogCategory, CatalogItem } from './catalog';

function cat(partial: Partial<CatalogCategory> & { id: string; name: string }): CatalogCategory {
  return {
    organization_id: 'org',
    description: null,
    sort_order: 0,
    is_active: true,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function item(partial: Partial<CatalogItem> & { id: string; name: string }): CatalogItem {
  return {
    organization_id: 'org',
    category_id: null,
    description: null,
    type: 'product',
    price: 0,
    currency: 'XOF',
    tax_rate: null,
    is_active: true,
    sku: null,
    photo_url: null,
    duration_minutes: null,
    stock: null,
    metadata: {},
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('catalog-quality', () => {
  it('returns 0 for empty catalog', () => {
    const report = computeCatalogQuality([], []);
    expect(report.score).toBe(0);
    expect(report.kpis.products).toBe(0);
  });

  it('scores a complete item highly', () => {
    const categories = [cat({ id: 'c1', name: 'Pizzas' })];
    const items = [
      item({
        id: 'i1',
        name: 'Pizza Margherita',
        category_id: 'c1',
        description: 'Tomate, mozzarella',
        price: 3500,
        photo_url: 'https://example.com/p.jpg',
        metadata: {
          options: [
            {
              id: 'g1',
              name: 'Taille',
              kind: 'size',
              selection: 'single',
              required: true,
              choices: [
                { id: 'a', label: 'M', priceDelta: 0 },
                { id: 'b', label: 'L', priceDelta: 500 },
              ],
            },
          ],
        },
        catalog_categories: { name: 'Pizzas' },
      }),
    ];
    const report = computeCatalogQuality(categories, items);
    expect(report.score).toBeGreaterThan(70);
    expect(report.kpis.withoutImage).toBe(0);
    expect(report.kpis.withOptions).toBe(1);
  });

  it('recommends missing images and variants', () => {
    const categories = [cat({ id: 'c1', name: 'Burgers' })];
    const items = [
      item({
        id: 'i1',
        name: 'Cheeseburger',
        category_id: 'c1',
        price: 2500,
        catalog_categories: { name: 'Burgers' },
      }),
    ];
    const report = computeCatalogQuality(categories, items);
    expect(report.recommendations.some((r) => r.kind === 'missing_image')).toBe(true);
    expect(report.recommendations.some((r) => r.kind === 'missing_variants')).toBe(true);
  });
});
