import { describe, expect, it } from 'vitest';
import {
  computeItemUnitPrice,
  computeOptionsPriceDelta,
  defaultSelections,
  getItemOptions,
  hasOptions,
  summarizeSelections,
  validateSelections,
  type OptionGroup,
} from './catalog-options';

const groups: OptionGroup[] = [
  {
    id: 'size',
    name: 'Taille',
    kind: 'size',
    selection: 'single',
    required: true,
    choices: [
      { id: 's', label: 'Petite', priceDelta: 0, isDefault: true },
      { id: 'm', label: 'Moyenne', priceDelta: 500 },
      { id: 'l', label: 'Grande', priceDelta: 1000 },
    ],
  },
  {
    id: 'sup',
    name: 'Suppléments',
    kind: 'supplement',
    selection: 'multiple',
    required: false,
    choices: [
      { id: 'bacon', label: 'Bacon', priceDelta: 700 },
      { id: 'cheese', label: 'Fromage', priceDelta: 400 },
    ],
  },
  {
    id: 'rm',
    name: 'Retirer',
    kind: 'removable',
    selection: 'multiple',
    required: false,
    choices: [{ id: 'onion', label: 'Oignon', priceDelta: 0 }],
  },
];

describe('catalog-options', () => {
  it('pre-selects required/default choices', () => {
    const sel = defaultSelections(groups);
    expect(sel.size).toEqual(['s']);
    expect(sel.sup).toEqual([]);
    expect(sel.rm).toEqual([]);
  });

  it('computes price deltas across single and multiple groups', () => {
    const sel = { size: ['l'], sup: ['bacon', 'cheese'], rm: ['onion'] };
    expect(computeOptionsPriceDelta(groups, sel)).toBe(1000 + 700 + 400);
    expect(computeItemUnitPrice(5000, groups, sel)).toBe(7100);
  });

  it('never returns a negative unit price', () => {
    const negative: OptionGroup[] = [
      {
        id: 'discount',
        name: 'Remise',
        kind: 'custom',
        selection: 'single',
        required: false,
        choices: [{ id: 'x', label: 'Remise', priceDelta: -9999 }],
      },
    ];
    expect(computeItemUnitPrice(1000, negative, { discount: ['x'] })).toBe(0);
  });

  it('summarizes selections with removable prefix', () => {
    const sel = { size: ['l'], sup: ['bacon'], rm: ['onion'] };
    expect(summarizeSelections(groups, sel)).toBe('Grande · Bacon · sans Oignon');
  });

  it('flags missing required groups', () => {
    expect(validateSelections(groups, { size: [], sup: [], rm: [] })).toMatch(/Taille/);
    expect(validateSelections(groups, { size: ['s'], sup: [], rm: [] })).toBeNull();
  });

  it('reads options from item metadata', () => {
    expect(hasOptions({ metadata: { options: groups } })).toBe(true);
    expect(getItemOptions({ metadata: {} })).toEqual([]);
    expect(getItemOptions({ metadata: null })).toEqual([]);
  });
});
