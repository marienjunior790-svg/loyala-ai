import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BrandLockup } from '@/components/brand/liquid-logo';
import { buildDemoBookingMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { DEMO_WHATSAPP } from '@/lib/marketing/config';

const demoUrl = buildWhatsAppUrl(DEMO_WHATSAPP, buildDemoBookingMessage());

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <div className="glass-liquid mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full pl-3 pr-2 sm:pl-4">
        <Link href="/" aria-label="Loyala AI — accueil" className="rounded-full">
          <BrandLockup size={40} priority />
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          {[
            { href: '#solution', label: 'Solution' },
            { href: '#demo', label: 'Démo' },
            { href: '#pricing', label: 'Tarifs' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 transition hover:bg-white/[0.06] hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" asChild className="hidden rounded-full sm:inline-flex">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button size="sm" asChild className="rounded-full px-4">
            <a href={demoUrl} target="_blank" rel="noopener noreferrer">
              Démo WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
