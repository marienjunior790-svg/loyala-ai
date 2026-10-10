import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Loyala AI — CRM WhatsApp',
    short_name: 'Loyala',
    description: 'CRM IA pour restaurants africains',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#040705',
    theme_color: '#040705',
    lang: 'fr',
    icons: [
      { src: '/icon.png', sizes: '128x128', type: 'image/png' },
      { src: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/brand/loyala-mark.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
