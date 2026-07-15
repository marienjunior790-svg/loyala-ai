/**
 * Auth diagnostics for local / preview only.
 * Enable with AUTH_DEBUG=1. Never emits on production deployments
 * (VERCEL_ENV=production, or NODE_ENV=production outside Vercel).
 */
export function isAuthDebugEnabled(): boolean {
  if (process.env.AUTH_DEBUG !== '1') return false;
  if (process.env.VERCEL_ENV === 'production') return false;
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV) return false;
  return true;
}

export function authDebug(label: string, data: Record<string, unknown>): void {
  if (!isAuthDebugEnabled()) return;
  console.info(`[auth:${label}]`, JSON.stringify(data));
}
