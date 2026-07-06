import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { buildDemoBookingMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { DEMO_WHATSAPP } from '@/lib/marketing/config';

const demoUrl = buildWhatsAppUrl(DEMO_WHATSAPP, buildDemoBookingMessage());

const steps = [
  'Votre fichier clients en direct',
  'Relance WhatsApp en 1 clic',
  'Estimation ROI en 1 semaine',
];

export function DemoSection() {
  return (
    <section id="demo" className="border-t border-border/40 px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Démo 3 minutes
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight">
          Voyez Loyala sur votre téléphone
        </h2>
        <p className="mt-4 text-muted-foreground">
          Pas de slides. On vous montre comment relancer un vrai client sur WhatsApp.
        </p>
        <Card className="mx-auto mt-10 max-w-md border-primary/20 text-left">
          <CardContent className="space-y-3 p-6">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </CardContent>
        </Card>
        <Button size="lg" className="mt-8 h-12 px-8" asChild>
          <a href={demoUrl} target="_blank" rel="noopener noreferrer">
            Réserver ma démo WhatsApp
          </a>
        </Button>
      </div>
    </section>
  );
}
