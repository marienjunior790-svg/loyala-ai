import type { VisitItemInput } from '@loyala/validation';
import type { ExternalOrderIdentity } from './orders';
import {
  computeItemUnitPrice,
  getItemOptions,
  optionSelectionError,
  summarizeSelections,
  type OptionQuantities,
  type OptionSelections,
} from './catalog-options';

/** Système externe de la saisie employé. Ce n'est pas un message WhatsApp. */
export const STAFF_SALE_SYSTEM = 'loyala_saisie';

const MAX_QUANTITY = 999;

export interface CatalogSaleSource {
  id: string;
  organizationId: string;
  name: string;
  price: number;
  currency: string;
  type: 'product' | 'service' | 'rental';
  isActive: boolean;
  categoryName: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ResolvedStaffSaleLines {
  mode: 'lines';
  items: VisitItemInput[];
  subtotal: number;
  currency: string;
}

export interface ResolvedStaffSaleAmount {
  mode: 'amount';
  amount: number;
  subtotal: number;
  currency: null;
}

export type ResolvedStaffSale = ResolvedStaffSaleLines | ResolvedStaffSaleAmount;

export type StaffSaleResolution =
  | { ok: true; sale: ResolvedStaffSale; discount: number }
  | { ok: false; error: string };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function catalogIdOf(item: VisitItemInput): string | null {
  const id = item.catalogItemId?.trim();
  return id ? id : null;
}

/**
 * Prix, nom et devise viennent du catalogue du restaurant.
 * Le prix envoyé par le navigateur n'est pas utilisé.
 * Sans ligne, le montant global reste un cas distinct.
 */
export function resolveStaffSale(input: {
  organizationId: string;
  items?: VisitItemInput[];
  amount?: number;
  discount?: number;
  catalog: CatalogSaleSource[];
  /** Fuseau du restaurant. Le SQL de la migration 045 utilise le même. */
  timeZone?: string;
  now?: Date;
}): StaffSaleResolution {
  const discount = roundMoney(Number(input.discount ?? 0));
  if (!Number.isFinite(discount) || discount < 0) {
    return { ok: false, error: 'Remise invalide' };
  }

  const items = input.items ?? [];
  if (items.length === 0) {
    if (input.amount === undefined || !Number.isFinite(input.amount) || input.amount < 0) {
      return { ok: false, error: 'Ajoutez des articles ou un montant' };
    }
    const amount = roundMoney(input.amount);
    if (discount > amount) return { ok: false, error: 'Remise invalide' };
    return {
      ok: true,
      discount,
      sale: { mode: 'amount', amount, subtotal: amount, currency: null },
    };
  }

  const byId = new Map(input.catalog.map((row) => [row.id, row]));
  const resolved: VisitItemInput[] = [];
  let currency: string | null = null;
  let subtotal = 0;

  for (const line of items) {
    const catalogItemId = catalogIdOf(line);
    if (!catalogItemId) {
      return { ok: false, error: 'Chaque article doit venir du catalogue' };
    }
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
      return { ok: false, error: 'Quantité invalide' };
    }

    const source = byId.get(catalogItemId);
    if (!source || source.organizationId !== input.organizationId) {
      return { ok: false, error: 'Article introuvable dans ce restaurant' };
    }
    if (!source.isActive) {
      return { ok: false, error: `Article inactif : ${source.name}` };
    }

    const groups = getItemOptions({ metadata: source.metadata });
    const selections = (line.optionSelections ?? {}) as OptionSelections;
    const quantities = line.optionQuantities as OptionQuantities | undefined;
    const selectionError = optionSelectionError(
      groups,
      selections,
      quantities,
      input.now ?? new Date(),
      input.timeZone
    );
    if (selectionError) {
      const error = selectionError.startsWith('Choix requis indisponible')
        ? `Article indisponible : ${source.name}. ${selectionError}`
        : selectionError;
      return { ok: false, error };
    }

    const unitPrice = roundMoney(
      computeItemUnitPrice(Number(source.price), groups, selections, quantities)
    );
    const summary = summarizeSelections(groups, selections, quantities);
    const name = summary ? `${source.name} (${summary})` : source.name;
    if (currency === null) currency = source.currency;
    else if (currency !== source.currency) {
      return { ok: false, error: 'Les articles n’ont pas la même devise' };
    }

    subtotal = roundMoney(subtotal + roundMoney(quantity * unitPrice));
    resolved.push({
      catalogItemId,
      name,
      categoryName: source.categoryName ?? undefined,
      itemType: source.type,
      quantity,
      unitPrice,
      optionSelections: line.optionSelections,
      optionQuantities: line.optionQuantities,
    });
  }

  if (discount > subtotal) return { ok: false, error: 'Remise invalide' };
  return {
    ok: true,
    discount,
    sale: { mode: 'lines', items: resolved, subtotal, currency: currency ?? 'XOF' },
  };
}

export function staffSaleIdentity(
  submissionKey: string,
  currency: string | null
): ExternalOrderIdentity {
  return {
    system: STAFF_SALE_SYSTEM,
    orderId: submissionKey,
    currency,
    reportedStatus: 'paid',
  };
}

/** Vrai seulement quand la base n'expose pas encore la signature de la migration 044. */
export function orderRpcLacksIdempotency(message: string): boolean {
  const text = message.toLowerCase();
  if (!text.includes('record_client_order')) return false;
  return (
    text.includes('could not find the function') ||
    text.includes('does not exist') ||
    text.includes('schema cache') ||
    text.includes('pgrst202')
  );
}
