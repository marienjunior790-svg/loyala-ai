import type { MetadataRoute } from 'next';
import { getPublicAppUrl } from '@/lib/app-url';

const appUrl = getPublicAppUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: appUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${appUrl}/login`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${appUrl}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
