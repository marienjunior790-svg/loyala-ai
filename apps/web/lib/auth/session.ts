import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../supabase/server';
import { createAdminClient } from '@loyala/db';
import { ORG_COOKIE_NAME, type AuthContext } from '@loyala/core-iam';
import { cookies } from 'next/headers';
import { getSupabaseEnv, getServiceRoleKey } from '../supabase/env';
import { getActiveMembership } from './membership';
import { resolveOrgRole } from './role-map';
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

export type AuthAccess =
  | { status: 'anonymous' }
  | { status: 'no_membership'; userId: string }
  /** Membre actif dont le rôle est absent, inconnu ou illisible : aucun accès. */
  | { status: 'denied'; userId: string; organizationId: string }
  | { status: 'ok'; ctx: AuthContext };

async function lookupRoleCode(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<string | null> {
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('role_id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();

  if (memberError || !member?.role_id) {
    authDebug('getAuthAccess', {
      userId,
      organizationId,
      reason: memberError ? 'member_lookup_failed' : 'no_role',
      error: memberError?.message ?? null,
    });
    return null;
  }

  const { data: roleRow, error: roleError } = await supabase
    .from('roles')
    .select('code')
    .eq('id', member.role_id)
    .maybeSingle();

  if (roleError) {
    authDebug('getAuthAccess', { userId, reason: 'role_lookup_failed', error: roleError.message });
  }
  return roleRow?.code ?? null;
}

/**
 * Resolves tenant access for the current request. Refus par défaut : seul un
 * rôle reconnu donne un contexte ; un rôle absent ou inconnu donne « denied ».
 */
export const getAuthAccess = cache(async (): Promise<AuthAccess> => {
  const user = await getSession();
  if (!user) return { status: 'anonymous' };

  const cookieStore = await cookies();
  const orgCookie = cookieStore.get(ORG_COOKIE_NAME)?.value;

  const supabase = await createClient();
  const active = await getActiveMembership(supabase);
  if (!active) {
    authDebug('getAuthAccess', { userId: user.id, orgCookie, reason: 'no_active_membership' });
    return { status: 'no_membership', userId: user.id };
  }

  const organizationId = active.organization_id;
  if (orgCookie && orgCookie !== organizationId) {
    authDebug('getAuthAccess', {
      userId: user.id,
      orgCookie,
      resolvedOrg: organizationId,
      reason: 'stale_org_cookie',
    });
  }

  const roleCode = active.role_code ?? (await lookupRoleCode(supabase, user.id, organizationId));
  const role = resolveOrgRole(roleCode);
  if (!role) {
    authDebug('getAuthAccess', {
      userId: user.id,
      organizationId,
      roleCode: roleCode ?? null,
      reason: 'role_not_recognized',
      ok: false,
    });
    return { status: 'denied', userId: user.id, organizationId };
  }

  authDebug('getAuthAccess', { userId: user.id, organizationId, role, ok: true });
  return { status: 'ok', ctx: { userId: user.id, organizationId, role } };
});

/** Contexte d'un membre au rôle reconnu ; null sinon (non connecté, sans restaurant ou rôle refusé). */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const access = await getAuthAccess();
  return access.status === 'ok' ? access.ctx : null;
});

/** Admin client — onboarding & tests only */
export function getAdminClient() {
  const { url } = getSupabaseEnv();
  return createAdminClient(url, getServiceRoleKey());
}
