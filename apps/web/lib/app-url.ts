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
