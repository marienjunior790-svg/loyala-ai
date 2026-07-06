const ALLOWED_PATHS = new Set([
  '/dashboard',
  '/clients',
  '/clients/ajouter',
  '/onboarding',
  '/reset-password',
]);

/** Prevent open redirects — only allow relative in-app paths. */
export function safeAuthRedirectPath(next: string | null): string {
  if (!next) return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  if (next.includes('\\') || next.includes('@')) return '/dashboard';

  const path = next.split('?')[0] ?? '/dashboard';
  if (ALLOWED_PATHS.has(path) || path.startsWith('/clients/')) {
    return next;
  }

  return '/dashboard';
}
