import { cache } from 'react';
import { createClient } from '../supabase/server';
import { createAdminClient } from '@loyala/db';
import { ORG_COOKIE_NAME, type AuthContext, type OrgRole } from '@loyala/core-iam';
import { cookies } from 'next/headers';
import { getSupabaseEnv, getServiceRoleKey } from '../supabase/env';
import { getActiveMembership } from './membership';
import { resolveOrgRole, normalizeOrgRole } from './role-map';
import { authDebug } from './debug';

export const getSession = cache(async () => {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const authCookies = cookieStore.getAll().filter((c) => c.name.includes('auth'));

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  authDebug('getSession', {
    hasUser: Boolean(user),
    authCookieCount: authCookies.length,
    error: error?.message ?? null,
  });

  if (error || !user) return null;
  return user;
});

/**
 * Resolves tenant context for the current request.
 * Returns null only when the user has no active membership — not when unauthenticated.
 * Call getSession() separately to distinguish login vs onboarding redirects.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getSession();
  if (!user) return null;

  const cookieStore = await cookies();
  const orgCookie = cookieStore.get(ORG_COOKIE_NAME)?.value;

  const supabase = await createClient();
  const active = await getActiveMembership(supabase);
  if (!active) {
    authDebug('getAuthContext', {
      userId: user.id,
      orgCookie,
      reason: 'no_active_membership',
    });
    return null;
  }

  const organizationId = active.organization_id;

  if (orgCookie && orgCookie !== organizationId) {
    authDebug('getAuthContext', {
      userId: user.id,
      orgCookie,
      resolvedOrg: organizationId,
      reason: 'stale_org_cookie',
    });
  }

  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id, role_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();

  if (memberError || !member) {
    authDebug('getAuthContext', {
      userId: user.id,
      organizationId,
      reason: 'member_lookup_failed_rpc_fallback',
      error: memberError?.message ?? 'no_row',
    });
    // RPC confirmed membership — default staff (write CRM, no delete escalation)
    return {
      userId: user.id,
      organizationId,
      role: 'org_staff',
    };
  }

  let role: OrgRole = 'org_viewer';

  if (member.role_id) {
    const { data: roleRow, error: roleError } = await supabase
      .from('roles')
      .select('code')
      .eq('id', member.role_id)
      .maybeSingle();

    if (roleError) {
      authDebug('getAuthContext', {
        userId: user.id,
        reason: 'role_lookup_failed',
        error: roleError.message,
      });
    }

    role = normalizeOrgRole(resolveOrgRole(roleRow?.code));
  }

  authDebug('getAuthContext', {
    userId: user.id,
    organizationId: member.organization_id,
    role,
    roleId: member.role_id,
    ok: true,
  });

  return {
    userId: user.id,
    organizationId: member.organization_id,
    role: normalizeOrgRole(role),
  };
});

/** Admin client — onboarding & tests only */
export function getAdminClient() {
  const { url } = getSupabaseEnv();
  return createAdminClient(url, getServiceRoleKey());
}
