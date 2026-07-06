import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Loyala AI — CRM IA WhatsApp pour restaurants',
  description:
    'Transformez vos clients en revenus récurrents via WhatsApp. CRM IA pour restaurants africains.',
  openGraph: {
    title: 'Loyala AI',
    description: 'CRM IA WhatsApp pour restaurants africains',
  },
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
