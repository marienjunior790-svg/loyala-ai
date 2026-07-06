import { redirect } from 'next/navigation';
import { getAuthContext, getSession } from './session';
import { hasPermission, type AuthContext, type Permission } from '@loyala/core-iam';
import { normalizeOrgRole } from './role-map';
import { authDebug } from './debug';

function withSafeContext(ctx: AuthContext): AuthContext {
  return {
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    role: normalizeOrgRole(ctx.role ?? 'org_viewer'),
  };
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
  const hasMembership = Boolean(ctx.organizationId);
  const roleGranted = hasPermission(ctx, permission);
  const clientsReadGranted =
    permission === 'clients:read' && hasMembership && ctx.userId;
  const clientsWriteGranted =
    permission === 'clients:write' && hasMembership && ctx.userId;

  authDebug('requireAuthPermission', {
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    role: ctx.role,
    hasMembership,
    permission,
    hasClientsAccess: roleGranted || clientsReadGranted || clientsWriteGranted,
    decision: roleGranted || clientsReadGranted || clientsWriteGranted ? 'allow' : 'deny',
  });

  if (roleGranted || clientsReadGranted || clientsWriteGranted) {
    return ctx;
  }

  // Authenticated + org exists but missing write/delete — stay in CRM (never /dashboard)
  if (permission.startsWith('clients:') && hasMembership) {
    authDebug('requireAuthPermission', {
      decision: 'redirect_clients',
      reason: 'insufficient_permission',
      permission,
      redirect: '/clients',
    });
    redirect('/clients');
  }

  authDebug('requireAuthPermission', {
    decision: 'redirect_onboarding',
    reason: 'permission_denied',
    permission,
    redirect: '/onboarding',
  });
  redirect('/onboarding');
}
