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

  it('unwraps { data } wrappers', () => {
    const text = menuJsonToText({
      status: 'ok',
      data: [{ name: 'Salades', items: [{ name: 'César', price: 2500 }] }],
    });
    expect(text).toMatch(/César — 2500/);
  });
});
