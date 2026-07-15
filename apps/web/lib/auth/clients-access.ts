import type { AuthContext } from '@loyala/core-iam';
import { hasPermission } from '@loyala/core-iam';

/**
 * Formal MVP policy (P1): any active org member may write clients unless
 * CRM_MVP_CLIENTS_BYPASS=false, in which case strict RBAC (clients:write) applies.
 *
 * Default: bypass ON (true) for restaurant staff onboarding.
 * Delete path never uses the bypass — see canDeleteClients.
 */
export function isCrmMvpClientsBypassEnabled(
  source: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = source.CRM_MVP_CLIENTS_BYPASS?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  return true;
}

/** Active org membership required for any CRM client access helper. */
function hasActiveOrgMembership(ctx: AuthContext): boolean {
  return Boolean(ctx.userId && ctx.organizationId);
}

/** MVP / RBAC: write clients */
export function canWriteClients(ctx: AuthContext): boolean {
  if (!hasActiveOrgMembership(ctx)) return false;
  if (hasPermission(ctx, 'clients:write')) return true;
  return isCrmMvpClientsBypassEnabled();
}

/** Read: RBAC clients:read OR same membership bypass when enabled. */
export function canReadClients(ctx: AuthContext): boolean {
  if (!hasActiveOrgMembership(ctx)) return false;
  if (hasPermission(ctx, 'clients:read')) return true;
  return isCrmMvpClientsBypassEnabled();
}

/** Suppression réservée aux rôles avec clients:delete (pas de bypass MVP). */
export function canDeleteClients(ctx: AuthContext): boolean {
  return hasPermission(ctx, 'clients:delete');
}
