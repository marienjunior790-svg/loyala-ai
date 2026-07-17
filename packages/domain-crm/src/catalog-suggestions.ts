import type { OptionGroup, OptionChoice } from './catalog-options';

/**
 * Rule-based variant suggester. Given a product's name/category, proposes
 * relevant option groups (sizes, cooking, milk, etc.) that the user validates.
 * Deterministic, free (no AI call) and safe to run over 10k products.
 *
 * Price deltas use a neutral 0 base by default so they work with any currency;
 * the caller/editor can adjust amounts afterwards.
 */

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function gid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function choice(label: string, priceDelta = 0, isDefault = false): OptionChoice {
  return { id: gid('c'), label, priceDelta, ...(isDefault ? { isDefault: true } : {}) };
}

function group(
  name: string,
  kind: OptionGroup['kind'],
  choices: OptionChoice[],
  opts: { required?: boolean; selection?: 'single' | 'multiple' } = {}
): OptionGroup {
  return {
    id: gid('g'),
    name,
    kind,
    selection: opts.selection ?? 'single',
    required: opts.required ?? false,
    choices,
  };
}

const SIZE_GROUP = (small = 0, medium = 1000, large = 2000): OptionGroup =>
  group(
    'Taille',
    'size',
    [
      choice('Petite', small, true),
      choice('Moyenne', medium),
      choice('Grande', large),
    ],
    { required: true }
  );

const COOKING_GROUP = (): OptionGroup =>
  group(
    'Cuisson',
    'cooking',
    [choice('Saignant'), choice('À point', 0, true), choice('Bien cuit')],
    { required: true }
  );

const MILK_GROUP = (): OptionGroup =>
  group('Lait', 'custom', [
    choice('Entier', 0, true),
    choice('Demi-écrémé'),
    choice('Végétal', 200),
  ]);

const SPICE_GROUP = (): OptionGroup =>
  group('Niveau de piquant', 'spice', [
    choice('Doux', 0, true),
    choice('Moyen'),
    choice('Fort'),
  ]);

interface Rule {
  match: RegExp;
  build: () => OptionGroup[];
}

const RULES: Rule[] = [
  { match: /\bpizza/, build: () => [SIZE_GROUP(0, 1500, 3000)] },
  { match: /\bburger|\bhamburger|\bcheeseburger/, build: () => [COOKING_GROUP()] },
  {
    match: /\b(cafe|café|cappuccino|latte|espresso|americano|mocha|macchiato)/,
    build: () => [SIZE_GROUP(0, 300, 600), MILK_GROUP()],
  },
  { match: /\b(the|thé|infusion|matcha)/, build: () => [SIZE_GROUP(0, 200, 400)] },
  { match: /\b(cocktail|mojito|margarita|caipirinha|daiquiri|spritz|punch)/, build: () => [SIZE_GROUP(0, 1000, 2000)] },
  { match: /\b(jus|smoothie|milkshake|soda|limonade|frappe|frappé)/, build: () => [SIZE_GROUP(0, 300, 600)] },
  { match: /\b(glace|ice ?cream|sorbet)/, build: () => [group('Parfum', 'flavor', [choice('Vanille', 0, true), choice('Chocolat'), choice('Fraise')], { required: true })] },
  { match: /\b(pates|pâtes|pasta|riz|rice|bowl|salade|salad|tacos|wrap|sandwich)/, build: () => [group('Portion', 'portion', [choice('Simple', 0, true), choice('Double', 1500), choice('Familiale', 3000)], { required: true })] },
  { match: /\b(curry|tandoori|thai|thaï|mexicain|piment|spicy)/, build: () => [SPICE_GROUP()] },
];

/**
 * Suggest option groups for a product. Returns an empty array when no rule
 * matches (the caller can then fall back to a generic size/portion group).
 */
export function suggestVariants(name: string, category?: string | null): OptionGroup[] {
  const haystack = `${slug(name)} ${slug(category ?? '')}`;
  const matched = RULES.filter((r) => r.match.test(haystack));
  if (matched.length === 0) return [];
  // Merge groups from all matching rules, de-duplicating by group name.
  const seen = new Set<string>();
  const out: OptionGroup[] = [];
  for (const rule of matched) {
    for (const g of rule.build()) {
      const key = g.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(g);
    }
  }
  return out;
}

/** Whether any rule would suggest variants for this product (cheap pre-check). */
export function hasSuggestions(name: string, category?: string | null): boolean {
  const haystack = `${slug(name)} ${slug(category ?? '')}`;
  return RULES.some((r) => r.match.test(haystack));
}
