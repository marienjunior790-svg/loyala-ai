import { describe, expect, it } from 'vitest';
import {
  orderRpcLacksIdempotency,
  resolveStaffSale,
  staffSaleIdentity,
  STAFF_SALE_SYSTEM,
  type CatalogSaleSource,
} from './staff-sale';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const THIEB = '33333333-3333-4333-8333-333333333333';
const BISSAP = '44444444-4444-4444-8444-444444444444';
const INACTIVE = '55555555-5555-4555-8555-555555555555';

function item(overrides: Partial<CatalogSaleSource> & Pick<CatalogSaleSource, 'id' | 'name' | 'price'>): CatalogSaleSource {
  return {
    organizationId: ORG,
    currency: 'XOF',
    type: 'product',
    isActive: true,
    categoryName: 'Plats',
    metadata: {},
    ...overrides,
  };
}

const catalog = [
  item({ id: THIEB, name: 'Thiéboudienne', price: 2500 }),
  item({ id: BISSAP, name: 'Bissap', price: 500, categoryName: 'Boissons' }),
  item({ id: INACTIVE, name: 'Ancien plat', price: 1000, isActive: false }),
  item({
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Yassa',
    price: 3000,
    metadata: {
      options: [
        {
          id: 'size',
          name: 'Taille',
          kind: 'size',
          selection: 'single',
          required: true,
          choices: [
            { id: 's', label: 'Petite', priceDelta: 0 },
            { id: 'l', label: 'Grande', priceDelta: 500 },
          ],
        },
      ],
    },
  }),
];

describe('resolveStaffSale', () => {
  it('enregistre une ligne au prix du catalogue, pas au prix envoyé', () => {
    const result = resolveStaffSale({
      organizationId: ORG,
      items: [{ catalogItemId: THIEB, name: 'Prix falsifié', quantity: 2, unitPrice: 1 }],
      discount: 0,
      catalog,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.sale.mode !== 'lines') throw new Error('lignes attendues');
    expect(result.sale.items).toHaveLength(1);
    expect(result.sale.items[0]).toMatchObject({
      catalogItemId: THIEB,
      name: 'Thiéboudienne',
      quantity: 2,
      unitPrice: 2500,
    });
    expect(result.sale.subtotal).toBe(5000);
  });

  it('recalcule plusieurs articles et leurs quantités', () => {
    const result = resolveStaffSale({
      organizationId: ORG,
      items: [
        { catalogItemId: THIEB, name: 'Thiéboudienne', quantity: 1, unitPrice: 1 },
        { catalogItemId: BISSAP, name: 'Bissap', quantity: 3, unitPrice: 99999 },
      ],
      discount: 500,
      catalog,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.sale.mode !== 'lines') throw new Error('lignes attendues');
    expect(result.sale.subtotal).toBe(4000);
    expect(result.discount).toBe(500);
    expect(result.sale.items.map((line) => [line.name, line.quantity, line.unitPrice])).toEqual([
      ['Thiéboudienne', 1, 2500],
      ['Bissap', 3, 500],
    ]);
  });

  it('ajoute le supplément du catalogue et ignore un prix unitaire falsifié', () => {
    const result = resolveStaffSale({
      organizationId: ORG,
      items: [
        {
          catalogItemId: '66666666-6666-4666-8666-666666666666',
          name: 'Yassa trafiqué',
          quantity: 1,
          unitPrice: 10,
          optionSelections: { size: ['l'] },
        },
      ],
      catalog,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.sale.mode !== 'lines') throw new Error('lignes attendues');
    expect(result.sale.items[0].unitPrice).toBe(3500);
    expect(result.sale.items[0].name).toBe('Yassa (Grande)');
  });

  it('refuse un article inactif, absent, d’un autre restaurant, ou sans catalogue', () => {
    expect(
      resolveStaffSale({
        organizationId: ORG,
        items: [{ catalogItemId: INACTIVE, name: 'Ancien plat', quantity: 1, unitPrice: 1000 }],
        catalog,
      })
    ).toEqual({ ok: false, error: 'Article inactif : Ancien plat' });

    expect(
      resolveStaffSale({
        organizationId: ORG,
        items: [{ catalogItemId: THIEB, name: 'Thiéboudienne', quantity: 1, unitPrice: 2500 }],
        catalog: catalog.map((row) => (row.id === THIEB ? { ...row, organizationId: OTHER } : row)),
      })
    ).toEqual({ ok: false, error: 'Article introuvable dans ce restaurant' });

    expect(
      resolveStaffSale({
        organizationId: ORG,
        items: [{ catalogItemId: THIEB, name: 'Thiéboudienne', quantity: 1, unitPrice: 2500 }],
        catalog: [],
      })
    ).toEqual({ ok: false, error: 'Article introuvable dans ce restaurant' });

    expect(
      resolveStaffSale({
        organizationId: ORG,
        items: [{ name: 'Hors catalogue', quantity: 1, unitPrice: 1000 }],
        catalog,
      })
    ).toEqual({ ok: false, error: 'Chaque article doit venir du catalogue' });
  });

  it('conserve le montant global sans article et refuse une remise hors limites', () => {
    const lump = resolveStaffSale({
      organizationId: ORG,
      amount: 15000,
      discount: 1000,
      catalog: [],
    });
    expect(lump).toEqual({
      ok: true,
      discount: 1000,
      sale: { mode: 'amount', amount: 15000, subtotal: 15000, currency: null },
    });

    expect(
      resolveStaffSale({ organizationId: ORG, amount: 15000, discount: 16000, catalog: [] })
    ).toEqual({ ok: false, error: 'Remise invalide' });
    expect(
      resolveStaffSale({
        organizationId: ORG,
        items: [{ catalogItemId: BISSAP, name: 'Bissap', quantity: 1, unitPrice: 1 }],
        discount: 501,
        catalog,
      })
    ).toEqual({ ok: false, error: 'Remise invalide' });
    expect(
      resolveStaffSale({ organizationId: ORG, amount: 1000, discount: -1, catalog: [] })
    ).toEqual({ ok: false, error: 'Remise invalide' });
  });

  it('rend invendable un article dont le choix obligatoire est indisponible', () => {
    const blocked = resolveStaffSale({
      organizationId: ORG,
      items: [{ catalogItemId: THIEB, name: 'Thiéboudienne', quantity: 1, unitPrice: 1 }],
      catalog: [
        item({
          id: THIEB,
          name: 'Thiéboudienne',
          price: 2500,
          metadata: {
            options: [
              {
                id: 'size',
                name: 'Taille',
                kind: 'size',
                selection: 'single',
                required: true,
                choices: [
                  { id: 's', label: 'Petite', priceDelta: 0, availability: { status: 'unavailable' } },
                ],
              },
            ],
          },
        }),
      ],
    });
    expect(blocked).toEqual({
      ok: false,
      error: 'Article indisponible : Thiéboudienne. Choix requis indisponible : Taille',
    });
  });

  it('ignore un supplément facultatif indisponible et plafonne sa quantité', () => {
    const optional = resolveStaffSale({
      organizationId: ORG,
      items: [{ catalogItemId: BISSAP, name: 'Bissap', quantity: 1, unitPrice: 1 }],
      catalog: [
        item({
          id: BISSAP,
          name: 'Bissap',
          price: 500,
          metadata: {
            options: [
              {
                id: 'extra',
                name: 'Supplément',
                kind: 'supplement',
                selection: 'multiple',
                required: false,
                choices: [
                  { id: 'mint', label: 'Menthe', priceDelta: 200, availability: { status: 'unavailable' } },
                ],
              },
            ],
          },
        }),
      ],
    });
    expect(optional.ok).toBe(true);
    if (!optional.ok || optional.sale.mode !== 'lines') throw new Error('lignes attendues');
    expect(optional.sale.items[0].unitPrice).toBe(500);

    const tooMany = resolveStaffSale({
      organizationId: ORG,
      items: [
        {
          catalogItemId: BISSAP,
          name: 'Bissap',
          quantity: 1,
          unitPrice: 1,
          optionSelections: { extra: ['bacon'] },
          optionQuantities: { bacon: 3 },
        },
      ],
      catalog: [
        item({
          id: BISSAP,
          name: 'Bissap',
          price: 500,
          metadata: {
            options: [
              {
                id: 'extra',
                name: 'Supplément',
                kind: 'supplement',
                selection: 'multiple',
                required: false,
                choices: [{ id: 'bacon', label: 'Bacon', priceDelta: 300, maxQuantity: 2 }],
              },
            ],
          },
        }),
      ],
    });
    expect(tooMany).toEqual({
      ok: false,
      error: 'Quantité d\'option invalide pour « Bacon »',
    });
  });

  it('prépare une identité payée stable, jamais un message WhatsApp', () => {
    const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(staffSaleIdentity(key, 'XOF')).toEqual({
      system: STAFF_SALE_SYSTEM,
      orderId: key,
      currency: 'XOF',
      reportedStatus: 'paid',
    });
    expect(STAFF_SALE_SYSTEM.startsWith('wamid')).toBe(false);
  });
});

describe('orderRpcLacksIdempotency', () => {
  it('reconnaît l’absence de la signature 044 et ignore les autres erreurs', () => {
    expect(
      orderRpcLacksIdempotency(
        'Could not find the function public.record_client_order in the schema cache'
      )
    ).toBe(true);
    expect(orderRpcLacksIdempotency('Remise invalide')).toBe(false);
    expect(orderRpcLacksIdempotency('Client introuvable dans ce restaurant')).toBe(false);
  });
});
