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
