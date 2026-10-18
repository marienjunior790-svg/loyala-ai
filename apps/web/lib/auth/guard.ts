import { redirect } from 'next/navigation';
import { getAuthAccess } from './session';
import { hasPermission, type AuthContext, type Permission } from '@loyala/core-iam';
import { authDebug } from './debug';

export const ACCESS_DENIED_PATH = '/acces-refuse';

/**
 * Pure permission decision — membership + role map only.
 * organizationId alone NEVER grants clients:read / clients:write.
 */
export function evaluateAuthPermission(
  ctx: AuthContext,
  permission: Permission
): 'allow' | 'deny' {
  if (!ctx.userId || !ctx.organizationId) return 'deny';
  return hasPermission(ctx, permission) ? 'allow' : 'deny';
}

export async function requireAuth(): Promise<AuthContext> {
  const access = await getAuthAccess();

  if (access.status === 'ok') {
    const { ctx } = access;
    authDebug('requireAuth', {
      decision: 'allow',
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      role: ctx.role,
      hasMembership: true,
    });
    return ctx;
  }

  if (access.status === 'denied') {
    authDebug('requireAuth', {
      decision: 'redirect_access_denied',
      userId: access.userId,
      organizationId: access.organizationId,
      role: null,
      hasMembership: true,
      redirect: ACCESS_DENIED_PATH,
    });
    redirect(ACCESS_DENIED_PATH);
  }

  if (access.status === 'anonymous') {
    authDebug('requireAuth', {
      decision: 'redirect_login',
      userId: null,
      organizationId: null,
      role: null,
      hasMembership: false,
      redirect: '/login',
    });
    redirect('/login');
  }

  authDebug('requireAuth', {
    decision: 'redirect_onboarding',
    userId: access.userId,
    organizationId: null,
    role: null,
    hasMembership: false,
    redirect: '/onboarding',
  });
  redirect('/onboarding');
}

export async function requireAuthPermission(permission: Permission): Promise<AuthContext> {
  const ctx = await requireAuth();
  const decision = evaluateAuthPermission(ctx, permission);

  authDebug('requireAuthPermission', {
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    role: ctx.role,
    hasMembership: Boolean(ctx.organizationId),
    permission,
    decision,
  });

  if (decision === 'allow') {
    return ctx;
  }

  // Authenticated + org exists but missing write/delete — stay in CRM (never /dashboard)
  if (permission.startsWith('clients:') && ctx.organizationId) {
    authDebug('requireAuthPermission', {
      decision: 'redirect_clients',
      reason: 'insufficient_permission',
      permission,
      redirect: '/clients',
    });
    redirect('/clients');
  }

  authDebug('requireAuthPermission', {
    decision: 'redirect_dashboard',
    reason: 'permission_denied',
    permission,
    redirect: '/dashboard',
  });
  redirect('/dashboard');
}
