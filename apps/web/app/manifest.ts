import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Loyala AI — CRM WhatsApp',
    short_name: 'Loyala',
    description: 'CRM IA pour restaurants africains',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#16a34a',
    lang: 'fr',
  };
}
