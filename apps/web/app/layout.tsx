import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { getPublicAppUrl } from '@/lib/app-url';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Loyala AI — CRM IA WhatsApp pour restaurants',
    template: '%s | Loyala AI',
  },
  description:
    'Transformez vos clients en revenus récurrents via WhatsApp. CRM IA pour restaurants africains.',
  keywords: [
    'CRM restaurant',
    'WhatsApp marketing',
    'fidélité client',
    'restaurant Afrique',
    'relance clients',
    'Loyala AI',
  ],
  authors: [{ name: 'Loyala AI' }],
  creator: 'Loyala AI',
  openGraph: {
    title: 'Loyala AI — CRM WhatsApp pour restaurants',
    description: 'CRM IA pour restaurants africains. Relancez vos clients en 1 clic.',
    type: 'website',
    locale: 'fr_FR',
    url: appUrl,
    siteName: 'Loyala AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Loyala AI',
    description: 'CRM IA WhatsApp pour restaurants africains',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: appUrl },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
