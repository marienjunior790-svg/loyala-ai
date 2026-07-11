import type { MetadataRoute } from 'next';
import { getPublicAppUrl } from '@/lib/app-url';

const appUrl = getPublicAppUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/clients', '/campaigns', '/settings', '/api/'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
