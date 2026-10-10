'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BrandLockup } from '@/components/brand/liquid-logo';
import { useLiquidGlass } from '@/components/glass/use-liquid-glass';
import { buildDemoBookingMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { DEMO_WHATSAPP } from '@/lib/marketing/config';
import { cn } from '@/lib/utils';

const demoUrl = buildWhatsAppUrl(DEMO_WHATSAPP, buildDemoBookingMessage());

export function MarketingFooter() {
  const { rootRef, glassRef, mirror, active } = useLiquidGlass<HTMLElement>();

  return (
    <footer ref={rootRef} className="relative px-4 pb-8 pt-16">
      {mirror}
      <div
        ref={glassRef}
        className={cn(
          'glass mx-auto max-w-6xl rounded-3xl px-6 py-10 md:px-10',
          active && 'glass-webgl'
        )}
      >
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          <div className="flex flex-col items-center gap-3 md:items-start">
            <BrandLockup size={64} />
            <p className="text-sm text-muted-foreground">
              CRM IA WhatsApp pour restaurants africains
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild className="rounded-full">
              <Link href="/login">Connexion</Link>
            </Button>
            <Button asChild className="rounded-full">
              <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                Démo WhatsApp
              </a>
            </Button>
          </div>
        </div>
        <div className="mt-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Loyala AI · Dakar · XOF
        </p>
      </div>
    </footer>
  );
}
