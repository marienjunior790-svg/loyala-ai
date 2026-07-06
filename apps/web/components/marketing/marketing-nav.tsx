import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { buildDemoBookingMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { DEMO_WHATSAPP } from '@/lib/marketing/config';

const demoUrl = buildWhatsAppUrl(DEMO_WHATSAPP, buildDemoBookingMessage());

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <span className="text-sm font-bold text-primary">L</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Loyala AI</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#solution" className="transition hover:text-foreground">
            Solution
          </a>
          <a href="#demo" className="transition hover:text-foreground">
            Démo
          </a>
          <a href="#pricing" className="transition hover:text-foreground">
            Tarifs
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button size="sm" asChild>
            <a href={demoUrl} target="_blank" rel="noopener noreferrer">
              Démo WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
