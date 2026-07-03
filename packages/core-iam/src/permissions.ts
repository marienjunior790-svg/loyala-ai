/**
 * @loyala/core-iam — RBAC foundation
 * Blueprint §4 — ABAC policies added Sprint 1+.
 */

export const ORG_ROLES = [
  'org_owner',
  'org_admin',
  'org_manager',
  'org_staff',
  'org_viewer',
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export type Permission =
  | 'org:read'
  | 'org:settings'
  | 'team:invite'
  | 'analytics:read'
  | 'inbox:read'
  | 'inbox:reply'
  | 'clients:read'
  | 'clients:write'
  | 'clients:delete';

/** Role → permissions map */
export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  org_owner: [
    'org:read', 'org:settings', 'team:invite', 'analytics:read',
    'inbox:read', 'inbox:reply', 'clients:read', 'clients:write', 'clients:delete',
  ],
  org_admin: [
    'org:read', 'org:settings', 'team:invite', 'analytics:read',
    'inbox:read', 'inbox:reply', 'clients:read', 'clients:write', 'clients:delete',
  ],
  org_manager: [
    'org:read', 'analytics:read', 'inbox:read', 'inbox:reply',
    'clients:read', 'clients:write',
  ],
  org_staff: ['org:read', 'inbox:read', 'inbox:reply', 'clients:read', 'clients:write'],
  org_viewer: ['org:read', 'analytics:read', 'clients:read'],
};

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: OrgRole;
}

export function hasPermission(ctx: AuthContext, permission: Permission): boolean {
  return ROLE_PERMISSIONS[ctx.role].includes(permission);
}

export function requirePermission(ctx: AuthContext, permission: Permission): void {
  if (!hasPermission(ctx, permission)) {
    throw new Error(`[core-iam] Permission denied: ${permission}`);
  }
}
