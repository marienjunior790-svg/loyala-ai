import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PRICING_PLANS } from '@/lib/marketing/config';
import { cn } from '@/lib/utils';

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border/40 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Tarifs simples, ROI clair</h2>
          <p className="mt-4 text-muted-foreground">
            Un client qui revient paie votre abonnement. Pas de frais cachés.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col border-border/60',
                plan.highlighted && 'border-primary/40 shadow-glow ring-1 ring-primary/20'
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Le plus choisi
                </span>
              )}
              <CardContent className="flex flex-1 flex-col p-8">
                <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 w-full"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  asChild
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
