import { redirect } from 'next/navigation';
import { getAuthContext, getSession } from './session';
import { hasPermission, type AuthContext, type Permission } from '@loyala/core-iam';
import { authDebug } from './debug';

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (ctx) return ctx;

  const user = await getSession();
  if (!user) {
    authDebug('requireAuth', { redirect: '/login', reason: 'no_session' });
    redirect('/login');
  }

  authDebug('requireAuth', { redirect: '/onboarding', reason: 'no_membership', userId: user.id });
  redirect('/onboarding');
}

export async function requireAuthPermission(permission: Permission): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, permission)) {
    authDebug('requireAuthPermission', {
      redirect: '/dashboard',
      permission,
      role: ctx.role,
    });
    redirect('/dashboard');
  }
  return ctx;
}
