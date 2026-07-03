/** Tenant context — resolved server-side only (Blueprint T4) */
export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
  plan: 'starter' | 'growth' | 'enterprise';
  vertical: string;
}

export const ORG_COOKIE_NAME = 'loyala_org_id';
