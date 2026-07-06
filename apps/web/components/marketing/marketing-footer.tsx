import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { buildDemoBookingMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { DEMO_WHATSAPP } from '@/lib/marketing/config';

const demoUrl = buildWhatsAppUrl(DEMO_WHATSAPP, buildDemoBookingMessage());

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/40 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          <div>
            <p className="font-semibold">Loyala AI</p>
            <p className="mt-1 text-sm text-muted-foreground">
              CRM IA WhatsApp pour restaurants africains
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/login">Connexion</Link>
            </Button>
            <Button asChild>
              <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                Démo WhatsApp
              </a>
            </Button>
          </div>
        </div>
        <p className="mt-12 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Loyala AI · Dakar · XOF
        </p>
      </div>
    </footer>
  );
}
