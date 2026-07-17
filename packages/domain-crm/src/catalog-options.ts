import type { OptionGroupInput, OptionChoiceInput } from '@loyala/validation';

export type OptionGroup = OptionGroupInput;
export type OptionChoice = OptionChoiceInput;

/** Map of option group id → selected choice ids. */
export type OptionSelections = Record<string, string[]>;

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

/** Pre-select required/default choices so a line always starts in a valid state. */
export function defaultSelections(groups: OptionGroup[]): OptionSelections {
  const selections: OptionSelections = {};
  for (const group of groups) {
    if (group.selection === 'single') {
      const def =
        group.choices.find((c) => c.isDefault) ?? (group.required ? group.choices[0] : undefined);
      selections[group.id] = def ? [def.id] : [];
    } else {
      selections[group.id] = group.choices.filter((c) => c.isDefault).map((c) => c.id);
    }
  }
  return selections;
}

/** Sum of price deltas for the currently selected choices. */
export function computeOptionsPriceDelta(
  groups: OptionGroup[],
  selections: OptionSelections
): number {
  let delta = 0;
  for (const group of groups) {
    const chosen = selections[group.id] ?? [];
    for (const choice of group.choices) {
      if (chosen.includes(choice.id)) delta += Number(choice.priceDelta) || 0;
    }
  }
  return delta;
}

/** Final unit price = base price + option deltas (never negative). */
export function computeItemUnitPrice(
  basePrice: number,
  groups: OptionGroup[],
  selections: OptionSelections
): number {
  const total = Number(basePrice || 0) + computeOptionsPriceDelta(groups, selections);
  return Math.max(0, total);
}

/** Human-readable summary, e.g. "Grande · +Bacon · sans Oignon". */
export function summarizeSelections(
  groups: OptionGroup[],
  selections: OptionSelections
): string {
  const parts: string[] = [];
  for (const group of groups) {
    const chosen = selections[group.id] ?? [];
    for (const choice of group.choices) {
      if (!chosen.includes(choice.id)) continue;
      parts.push(group.kind === 'removable' ? `sans ${choice.label}` : choice.label);
    }
  }
  return parts.join(' · ');
}

/** Returns an error message if required groups are unfilled or over-selected. */
export function validateSelections(
  groups: OptionGroup[],
  selections: OptionSelections
): string | null {
  for (const group of groups) {
    const chosen = selections[group.id] ?? [];
    if (group.required && chosen.length === 0) return `Choix requis : ${group.name}`;
    if (group.selection === 'single' && chosen.length > 1) {
      return `Un seul choix possible pour ${group.name}`;
    }
  }
  return null;
}
