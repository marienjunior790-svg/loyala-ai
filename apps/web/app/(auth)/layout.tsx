import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLockup } from '@/components/brand/liquid-logo';
import { AuthGlassCard } from '@/components/auth/auth-glass-card';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/" aria-label="Loyala AI — accueil" className="rounded-2xl">
        <BrandLockup size={84} priority />
      </Link>
      <AuthGlassCard>{children}</AuthGlassCard>
      <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Loyala AI · Dakar</p>
    </main>
  );
}
