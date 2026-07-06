import type { MetadataRoute } from 'next';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://loyala-ai-web.vercel.app';

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
