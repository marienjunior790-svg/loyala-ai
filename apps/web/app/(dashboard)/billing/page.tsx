import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getOrganization } from '@loyala/domain-crm';
import { PRICING_PLANS } from '@/lib/marketing/config';
import { buildWhatsAppUrl, buildDemoBookingMessage } from '@/lib/whatsapp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

export default async function BillingPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const org = await getOrganization(supabase, ctx.organizationId);
  const upgradeUrl = buildWhatsAppUrl(
    process.env.NEXT_PUBLIC_DEMO_WHATSAPP ?? '065719922',
    `Bonjour Loyala 👋 Je souhaite upgrader mon plan (${org?.plan ?? 'starter'}) pour ${org?.name ?? 'mon restaurant'}.`
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Paiement & abonnement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez votre plan Loyala AI
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan actuel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold capitalize">
              {PLAN_LABELS[org?.plan ?? 'starter'] ?? org?.plan}
            </p>
            <Badge variant={org?.plan_status === 'active' ? 'success' : 'secondary'}>
              {org?.plan_status ?? 'trialing'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Facturation Stripe — contactez-nous pour activer le paiement en ligne.
          </p>
          <Button asChild className="mt-4">
            <a href={upgradeUrl} target="_blank" rel="noopener noreferrer">
              Upgrader via WhatsApp
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <Card key={plan.id} className={org?.plan === plan.id ? 'border-primary/40' : ''}>
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <p className="text-2xl font-bold">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground"> {plan.period}</span>
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Le paiement en ligne (Stripe) sera activé prochainement. En attendant, les upgrades se font
        via notre équipe.
      </p>
    </div>
  );
}
