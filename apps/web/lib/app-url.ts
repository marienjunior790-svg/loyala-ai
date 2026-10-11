/** Official production origin — custom domain on Vercel. */
export const PRODUCTION_APP_ORIGIN = 'https://loyala.fmagence.com';

/** Former production hosts, no longer served by this app. */
const LEGACY_HOSTS = new Set(['fmagence.online', 'www.fmagence.online']);

/**
 * Public app URL for metadata, sitemap, robots, and fallbacks when env is unset.
 * Production builds must set NEXT_PUBLIC_APP_URL=https://loyala.fmagence.com on Vercel.
 */
export function getPublicAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_APP_ORIGIN;
  }
  return 'http://localhost:3000';
}

/**
 * Origin used in Auth emails (reset / confirm). Links must point straight at the production
 * host: a host redirect would drop the recovery fragment. Legacy hosts are rewritten so a stale
 * APP_URL / SITE_URL still yields working links.
 */
export function getAuthEmailOrigin(): string {
  const base = getPublicAppUrl();
  try {
    const u = new URL(base);
    if (LEGACY_HOSTS.has(u.hostname)) {
      return PRODUCTION_APP_ORIGIN;
    }
    return u.origin;
  } catch {
    return base;
  }
}
