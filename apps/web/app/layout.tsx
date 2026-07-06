import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://loyala-ai-web.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'Loyala AI — CRM IA WhatsApp pour restaurants',
  description:
    'Transformez vos clients en revenus récurrents via WhatsApp. CRM IA pour restaurants africains.',
  openGraph: {
    title: 'Loyala AI — CRM WhatsApp pour restaurants',
    description: 'CRM IA pour restaurants africains. Relancez vos clients en 1 clic.',
    type: 'website',
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Loyala AI',
    description: 'CRM IA WhatsApp pour restaurants africains',
  },
  robots: { index: true, follow: true },
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
