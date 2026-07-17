import type { OptionGroupInput, OptionChoiceInput } from '@loyala/validation';
import { isAvailableNow } from './availability';

export type OptionGroup = OptionGroupInput;
export type OptionChoice = OptionChoiceInput;

/** Map of option group id → selected choice ids. */
export type OptionSelections = Record<string, string[]>;

/** Map of choice id → chosen quantity (for supplements with maxQuantity > 1). */
export type OptionQuantities = Record<string, number>;

/** Read the option groups stored in a catalog item's metadata. */
export function getItemOptions(item: {
  metadata?: Record<string, unknown> | null;
}): OptionGroup[] {
  const raw = (item?.metadata as { options?: unknown } | null | undefined)?.options;
  if (!Array.isArray(raw)) return [];
  return raw as OptionGroup[];
}

/** Whether an item exposes any configurable variant/option. */
export function hasOptions(item: { metadata?: Record<string, unknown> | null }): boolean {
  return getItemOptions(item).length > 0;
}

/** Minimum number of choices a group requires (min/max take precedence over legacy flags). */
export function effectiveMin(group: OptionGroup): number {
  if (typeof group.minChoices === 'number') return group.minChoices;
  return group.required ? 1 : 0;
}

/** Maximum number of choices a group allows (Infinity when unbounded). */
export function effectiveMax(group: OptionGroup): number {
  if (typeof group.maxChoices === 'number') return group.maxChoices;
  return group.selection === 'single' ? 1 : Number.POSITIVE_INFINITY;
}

/** Quantity chosen for a given choice (defaults to 1 when selected). */
function choiceQty(choiceId: string, quantities?: OptionQuantities): number {
  const q = quantities?.[choiceId];
  return q && q > 0 ? q : 1;
}

/**
 * Filter out options that are unavailable at `now`. Groups whose choices all
 * become unavailable are dropped. Used by the sale-time configurator so clients
 * never see out-of-stock or off-hours variants.
 */
export function filterAvailableGroups(groups: OptionGroup[], now: Date = new Date()): OptionGroup[] {
  const result: OptionGroup[] = [];
  for (const group of groups) {
    const choices = group.choices.filter((c) => isAvailableNow(c.availability, now));
    if (choices.length === 0) continue;
    result.push({ ...group, choices });
  }
  return result;
}

/** Pre-select required/default choices so a line always starts in a valid state. */
export function defaultSelections(groups: OptionGroup[]): OptionSelections {
  const selections: OptionSelections = {};
  for (const group of groups) {
    const single = effectiveMax(group) <= 1;
    if (single) {
      const def =
        group.choices.find((c) => c.isDefault) ??
        (effectiveMin(group) >= 1 ? group.choices[0] : undefined);
      selections[group.id] = def ? [def.id] : [];
    } else {
      selections[group.id] = group.choices.filter((c) => c.isDefault).map((c) => c.id);
    }
  }
  return selections;
}

/** Sum of price deltas for the currently selected choices, quantity-aware. */
export function computeOptionsPriceDelta(
  groups: OptionGroup[],
  selections: OptionSelections,
  quantities?: OptionQuantities
): number {
  let delta = 0;
  for (const group of groups) {
    const chosen = selections[group.id] ?? [];
    for (const choice of group.choices) {
      if (chosen.includes(choice.id)) {
        delta += (Number(choice.priceDelta) || 0) * choiceQty(choice.id, quantities);
      }
    }
  }
  return delta;
}

/** Final unit price = base price + option deltas (never negative). */
export function computeItemUnitPrice(
  basePrice: number,
  groups: OptionGroup[],
  selections: OptionSelections,
  quantities?: OptionQuantities
): number {
  const total = Number(basePrice || 0) + computeOptionsPriceDelta(groups, selections, quantities);
  return Math.max(0, total);
}

/** Human-readable summary, e.g. "Grande · +Bacon ×2 · sans Oignon". */
export function summarizeSelections(
  groups: OptionGroup[],
  selections: OptionSelections,
  quantities?: OptionQuantities
): string {
  const parts: string[] = [];
  for (const group of groups) {
    const chosen = selections[group.id] ?? [];
    for (const choice of group.choices) {
      if (!chosen.includes(choice.id)) continue;
      const qty = choiceQty(choice.id, quantities);
      const suffix = qty > 1 ? ` ×${qty}` : '';
      parts.push(group.kind === 'removable' ? `sans ${choice.label}` : `${choice.label}${suffix}`);
    }
  }
  return parts.join(' · ');
}

/** Returns an error message if group min/max constraints are not satisfied. */
export function validateSelections(
  groups: OptionGroup[],
  selections: OptionSelections
): string | null {
  for (const group of groups) {
    const chosen = selections[group.id] ?? [];
    const min = effectiveMin(group);
    const max = effectiveMax(group);
    if (chosen.length < min) {
      return min <= 1
        ? `Choix requis : ${group.name}`
        : `Choisissez au moins ${min} option(s) : ${group.name}`;
    }
    if (chosen.length > max) {
      return max <= 1
        ? `Un seul choix possible pour ${group.name}`
        : `Maximum ${max} option(s) pour ${group.name}`;
    }
  }
  return null;
}
