export const ORDER_STATUSES = ['paid', 'pending', 'cancelled', 'refunded', 'partially_refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Seules ces commandes comptent dans les dépenses, classements et fréquences. */
export const REVENUE_ORDER_STATUSES = ['paid', 'partially_refunded'] as const satisfies readonly OrderStatus[];

export const ORDER_TYPES = ['sur_place', 'a_emporter', 'livraison'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PAYMENT_METHODS = ['cash', 'wave', 'orange_money', 'free_money', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type OrderSource = 'manual' | 'historique' | 'whatsapp' | 'import' | 'pos';

/**
 * Identité stable d'une commande déjà confirmée par un système externe.
 * Le wamid d'un message WhatsApp n'est pas un identifiant de commande.
 */
export interface ExternalOrderIdentity {
  system: string;
  orderId: string;
  currency?: string | null;
  reportedStatus?: OrderStatus | null;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  paid: 'Payée',
  pending: 'En attente',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
  partially_refunded: 'Remboursée en partie',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  sur_place: 'Sur place',
  a_emporter: 'À emporter',
  livraison: 'Livraison',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  free_money: 'Free Money',
  card: 'Carte',
  other: 'Autre',
};

export interface OrderAmounts {
  status?: string | null;
  amount: number | string | null;
  refunded_amount?: number | string | null;
}

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Une ligne sans statut vient d'avant la migration 040 : elle était payée. */
export function countsAsRevenue(order: Pick<OrderAmounts, 'status'>): boolean {
  const status = order.status ?? 'paid';
  return (REVENUE_ORDER_STATUSES as readonly string[]).includes(status);
}

/** Montant encaissé et conservé : montant après remise, moins les remboursements. */
export function orderNetAmount(order: OrderAmounts): number {
  if (!countsAsRevenue(order)) return 0;
  return Math.max(toNumber(order.amount) - toNumber(order.refunded_amount), 0);
}
