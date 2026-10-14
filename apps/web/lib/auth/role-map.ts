import type { OrgRole } from '@loyala/core-iam';

/**
 * Map legacy / Prisma role codes to Loyala IAM roles. Same codes as
 * current_org_role_level (migration 040): anything else is refused.
 */
const ROLE_CODE_ALIASES = new Map<string, OrgRole>([
  ['proprietaire', 'org_owner'],
  ['propriétaire', 'org_owner'],
  ['owner', 'org_owner'],
  ['org_owner', 'org_owner'],
  ['org_admin', 'org_admin'],
  ['admin', 'org_admin'],
  ['administrateur', 'org_admin'],
  ['gestionnaire_organisation', 'org_admin'],
  ['org_manager', 'org_manager'],
  ['manager', 'org_manager'],
  ['org_staff', 'org_staff'],
  ['staff', 'org_staff'],
  ['org_viewer', 'org_viewer'],
  ['viewer', 'org_viewer'],
  ['member', 'org_staff'],
  ['membre', 'org_staff'],
]);

/** Refus par défaut : un code absent ou inconnu ne donne aucun rôle. */
export function resolveOrgRole(code: unknown): OrgRole | null {
  if (typeof code !== 'string') return null;
  return ROLE_CODE_ALIASES.get(code.trim().toLowerCase()) ?? null;
}
