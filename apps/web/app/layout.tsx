import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Loyala AI',
  description: 'CRM IA pour restaurants africains',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
