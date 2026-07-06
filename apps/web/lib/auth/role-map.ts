import type { OrgRole } from '@loyala/core-iam';
import { ORG_ROLES } from '@loyala/core-iam';

/** Map legacy / Prisma role codes to Loyala IAM roles. */
const ROLE_CODE_ALIASES: Record<string, OrgRole> = {
  proprietaire: 'org_owner',
  propriétaire: 'org_owner',
  owner: 'org_owner',
  org_owner: 'org_owner',
  org_admin: 'org_admin',
  admin: 'org_admin',
  administrateur: 'org_admin',
  gestionnaire_organisation: 'org_admin',
  org_manager: 'org_manager',
  manager: 'org_manager',
  org_staff: 'org_staff',
  staff: 'org_staff',
  org_viewer: 'org_viewer',
  viewer: 'org_viewer',
  member: 'org_staff',
  membre: 'org_staff',
};

export function resolveOrgRole(code: string | null | undefined): OrgRole {
  if (!code) return 'org_viewer';
  const normalized = code.trim().toLowerCase();
  return ROLE_CODE_ALIASES[normalized] ?? 'org_viewer';
}

/** Ensure role is a valid OrgRole before RBAC checks. */
export function normalizeOrgRole(role: unknown): OrgRole {
  if (typeof role === 'string') {
    const mapped = resolveOrgRole(role);
    if ((ORG_ROLES as readonly string[]).includes(mapped)) return mapped;
  }
  return 'org_viewer';
}
