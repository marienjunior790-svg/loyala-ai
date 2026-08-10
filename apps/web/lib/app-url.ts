/** Official production origin — custom domain on Vercel. */
export const PRODUCTION_APP_ORIGIN = 'https://fmagence.online';

/**
 * Public app URL for metadata, sitemap, robots, and fallbacks when env is unset.
 * Production builds must set NEXT_PUBLIC_APP_URL=https://fmagence.online on Vercel.
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
 * Origin used in Auth emails (reset / confirm). Prefer www production host so
 * apex → www 308 redirects do not drop recovery fragments, and avoid preview
 * *.vercel.app hosts when APP_URL / SITE_URL is configured.
 */
export function getAuthEmailOrigin(): string {
  const base = getPublicAppUrl();
  try {
    const u = new URL(base);
    if (u.hostname === 'fmagence.online') {
      u.hostname = 'www.fmagence.online';
    }
    return u.origin;
  } catch {
    return base;
  }
}
