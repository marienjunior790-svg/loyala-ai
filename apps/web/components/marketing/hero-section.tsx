import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiquidLogo } from '@/components/brand/liquid-logo';
import { HeroVisual } from './hero-visual';
import { buildDemoBookingMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { DEMO_WHATSAPP } from '@/lib/marketing/config';

const demoUrl = buildWhatsAppUrl(DEMO_WHATSAPP, buildDemoBookingMessage());

export function HeroSection() {
  return (
    <section className="relative px-6 pb-20 pt-14 md:pt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="text-center lg:text-left">
          <div className="mb-6 flex justify-center lg:justify-start">
            <LiquidLogo
              size={104}
              priority
              className="drop-shadow-[0_0_32px_hsl(var(--primary)/0.45)]"
            />
          </div>
          <p className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
            CRM IA · Restaurants Afrique francophone
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-[1.05]">
            Transformez vos clients en{' '}
            <span className="text-gradient-brand">revenus récurrents</span> via WhatsApp
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
            Loyala AI centralise vos clients, relance les inactifs et remplit vos tables — sans
            embaucher quelqu&apos;un de plus. Setup en moins de 2 minutes.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Button size="lg" className="h-12 rounded-full px-8 text-base" asChild>
              <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1 h-5 w-5" />
                Réserver une démo WhatsApp
              </a>
            </Button>
            <Button size="lg" variant="glass" className="h-12 rounded-full px-8 text-base" asChild>
              <Link href="/signup">
                Essai gratuit 24 heures
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Déjà utilisé par des restaurants à Dakar · Sans carte bancaire
          </p>
        </div>

        <HeroVisual className="mx-auto max-w-[460px]" />
      </div>
    </section>
  );
}
