import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PRICING_PLANS } from '@/lib/marketing/config';
import { cn } from '@/lib/utils';

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-28 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Tarifs simples, ROI clair</h2>
          <p className="mt-4 text-muted-foreground">
            Commencez gratuitement avec toutes les fonctionnalités. Passez à Pro quand vos
            relances tournent à plein régime. Pas de frais cachés.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                'flex flex-col',
                plan.highlighted &&
                  'glass-liquid bg-gradient-to-b from-primary/10 to-transparent shadow-glow-lg ring-1 ring-primary/25'
              )}
            >
              {plan.badge && (
                <span
                  className={cn(
                    'absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium',
                    plan.highlighted
                      ? 'bg-primary text-primary-foreground shadow-glow'
                      : 'border border-amber-300/40 bg-amber-300/15 text-amber-200'
                  )}
                >
                  {plan.badge}
                </span>
              )}
              <CardContent className="flex flex-1 flex-col p-8">
                <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'text-3xl font-semibold tracking-tight',
                      plan.highlighted && 'text-gradient-brand'
                    )}
                  >
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{plan.priceNote}</p>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 w-full rounded-full"
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
