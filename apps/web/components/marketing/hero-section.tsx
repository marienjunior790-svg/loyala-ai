import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildDemoBookingMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { DEMO_WHATSAPP } from '@/lib/marketing/config';

const demoUrl = buildWhatsAppUrl(DEMO_WHATSAPP, buildDemoBookingMessage());

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20 md:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          CRM IA · Restaurants Afrique francophone
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-[1.1]">
          Transformez vos clients en{' '}
          <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
            revenus récurrents
          </span>{' '}
          via WhatsApp
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Loyala AI centralise vos clients, relance les inactifs et remplit vos tables — sans
          embaucher quelqu&apos;un de plus. Setup en moins de 2 minutes.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-12 px-8 text-base shadow-glow" asChild>
            <a href={demoUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-5 w-5" />
              Réserver une démo WhatsApp
            </a>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
            <Link href="/signup">
              Essai gratuit 14 jours
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Déjà utilisé par des restaurants à Dakar · Sans carte bancaire
        </p>
      </div>
    </section>
  );
}
