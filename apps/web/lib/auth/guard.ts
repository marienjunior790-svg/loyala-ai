import { redirect } from 'next/navigation';
import { getAuthContext } from './session';
import { hasPermission, type AuthContext, type Permission } from '@loyala/core-iam';

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  return ctx;
}

export async function requireAuthPermission(permission: Permission): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, permission)) redirect('/dashboard');
  return ctx;
}
