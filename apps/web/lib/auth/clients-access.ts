import type { AuthContext } from '@loyala/core-iam';
import { hasPermission } from '@loyala/core-iam';

/** Write access strictly from role → permission map (no membership bypass). */
export function canWriteClients(ctx: AuthContext): boolean {
  return hasPermission(ctx, 'clients:write');
}

/** Suppression réservée aux rôles avec clients:delete. */
export function canDeleteClients(ctx: AuthContext): boolean {
  return hasPermission(ctx, 'clients:delete');
}

/** Ajustement manuel des points : propriétaire, administrateur, gérant. */
export function canAdjustLoyalty(ctx: AuthContext): boolean {
  return Boolean(ctx.userId && ctx.organizationId) && hasPermission(ctx, 'loyalty:adjust');
}

/** Remboursement : propriétaire, administrateur, gérant (refund_client_order, niveau 60). */
export function canRefundOrder(ctx: AuthContext): boolean {
  return Boolean(ctx.userId && ctx.organizationId) && hasPermission(ctx, 'orders:refund');
}

/** Must match assert_order_change_allowed (migration 040). */
export const ORDER_SELF_EDIT_WINDOW_MS = 15 * 60 * 1000;

export type OrderAuthorship = { created_by: string | null; created_at: string | null };

/** Saisie du membre lui-même, enregistrée il y a moins de 15 minutes. */
export function isOwnRecentOrder(order: OrderAuthorship, userId: string, now: number): boolean {
  if (!order.created_by || !order.created_at || order.created_by !== userId) return false;
  const createdAt = Date.parse(order.created_at);
  return Number.isFinite(createdAt) && now - createdAt < ORDER_SELF_EDIT_WINDOW_MS;
}

/**
 * Modifier ou annuler une commande : un gérant (ou plus) à tout moment ; un
 * membre de l'équipe seulement sa propre saisie, dans les 15 minutes.
 */
export function canChangeOrder(ctx: AuthContext, order: OrderAuthorship, now: number = Date.now()): boolean {
  if (!ctx.userId || !ctx.organizationId) return false;
  if (hasPermission(ctx, 'orders:manage')) return true;
  return hasPermission(ctx, 'clients:write') && isOwnRecentOrder(order, ctx.userId, now);
}
