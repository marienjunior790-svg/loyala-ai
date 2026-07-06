import type { AuthContext } from '@loyala/core-iam';
import { hasPermission } from '@loyala/core-iam';

/** MVP : tout membre actif du restaurant peut gérer les clients */
export function canWriteClients(ctx: AuthContext): boolean {
  if (hasPermission(ctx, 'clients:write')) return true;
  return Boolean(ctx.userId && ctx.organizationId);
}

/** Suppression réservée aux rôles avec clients:delete (pas de bypass MVP). */
export function canDeleteClients(ctx: AuthContext): boolean {
  return hasPermission(ctx, 'clients:delete');
}
