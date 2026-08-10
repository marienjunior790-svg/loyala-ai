import { redirect } from 'next/navigation';
import { getAuthContext, getSession } from './session';
import { hasPermission, type AuthContext, type Permission } from '@loyala/core-iam';
import { normalizeOrgRole } from './role-map';
import { authDebug } from './debug';

function withSafeContext(ctx: AuthContext): AuthContext {
  return {
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    role: normalizeOrgRole(ctx.role ?? 'org_owner'),
  };
}

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
  const raw = await getAuthContext();

  if (raw?.organizationId) {
    const ctx = withSafeContext(raw);
    authDebug('requireAuth', {
      decision: 'allow',
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      role: ctx.role,
      hasMembership: true,
    });
    return ctx;
  }

  const user = await getSession();
  if (!user) {
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
    userId: user.id,
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
