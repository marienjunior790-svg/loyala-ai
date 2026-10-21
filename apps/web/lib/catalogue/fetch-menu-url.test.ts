import { describe, expect, it } from 'vitest';
import { menuJsonToText } from './fetch-menu-url';

describe('menuJsonToText', () => {
  it('flattens DigiMenu-like category/item trees', () => {
    const text = menuJsonToText([
      {
        name: 'Pizzas',
        items: [
          { name: 'Margherita', price: 3500, description: 'Tomate mozzarella' },
          { name: 'Pepperoni', selling_price: 4500 },
        ],
      },
      {
        title: 'Boissons',
        children: [{ item_name: 'Coca', amount: 700, currency: 'XOF' }],
      },
    ]);
    expect(text).toMatch(/Pizzas/);
    expect(text).toMatch(/Margherita — 3500/);
    expect(text).toMatch(/Pepperoni — 4500/);
    expect(text).toMatch(/Coca — 700 XOF/);
  });

  it('lit les sections DigiMenu et les plats paginés', () => {
    const text = menuJsonToText({
      count: 2,
      results: [
        { type: 'section', item_names: { en: 'Starters', fr: 'Entrées' } },
        {
          type: 'item',
          item_names: { en: 'Braised chicken', fr: 'Poulet braisé' },
          item_descriptions: { fr: 'Servi avec alloco' },
          price: [{ price: 4500, description: '' }],
        },
      ],
    });
    expect(text).toMatch(/Entrées/);
    expect(text).toMatch(/Poulet braisé — 4500/);
    expect(text).toMatch(/Servi avec alloco/);
  });

  it('utilise le titre de carte quand les plats sont absents du premier appel', () => {
    const text = menuJsonToText([
      { id: 1, menu_title: 'Carte du soir', count: 12 },
      { id: 2, menu_titles: { en: 'Drinks', fr: 'Boissons' }, count: 4 },
    ]);
    expect(text).toMatch(/Carte du soir/);
    expect(text).toMatch(/Boissons/);
  });

  it('unwraps { data } wrappers', () => {
    const text = menuJsonToText({
      status: 'ok',
      data: [{ name: 'Salades', items: [{ name: 'César', price: 2500 }] }],
    });
    expect(text).toMatch(/César — 2500/);
  });
});
