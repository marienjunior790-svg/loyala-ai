import { hasPermission, isOrgRole } from '@loyala/core-iam';

/** Pure — testable sans session. Owner/admin ont org:settings via ROLE_PERMISSIONS. */
export function canManageWhatsAppEmbeddedSignup(ctx: {
  userId: string;
  organizationId: string;
  role: string;
}): boolean {
  if (!isOrgRole(ctx.role)) return false;
  return hasPermission(
    { userId: ctx.userId, organizationId: ctx.organizationId, role: ctx.role },
    'org:settings'
  );
}

/**
 * Organisation cible = session uniquement.
 * Un organizationId client éventuel est ignoré (jamais d’autorité navigateur).
 */
export function resolveEmbeddedSignupOrganizationId(
  sessionOrganizationId: string,
  _clientOrganizationId?: string
): string {
  return sessionOrganizationId;
}
