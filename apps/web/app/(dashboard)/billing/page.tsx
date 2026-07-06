import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getOrganization } from '@loyala/domain-crm';
import { PRICING_PLANS, DEMO_WHATSAPP } from '@/lib/marketing/config';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
  trial: 'Essai',
  pro: 'Pro',
};

export default async function BillingPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  let org: Awaited<ReturnType<typeof getOrganization>> = null;
  let error: string | null = null;

  try {
    org = await getOrganization(supabase, ctx.organizationId);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Impossible de charger l\'abonnement';
  }

  const upgradeUrl = buildWhatsAppUrl(
    DEMO_WHATSAPP,
    `Bonjour Loyala 👋 Je souhaite upgrader mon plan (${org?.plan ?? 'starter'}) pour ${org?.name ?? 'mon restaurant'}.`
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Paiement & abonnement</h2>
        <p className="mt-1 text-sm text-muted-foreground">Gérez votre plan Loyala AI</p>
      </div>

      {error && <ModuleError message={error} />}

      <Card>
        <CardHeader>
          <CardTitle>Plan actuel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold capitalize">
              {PLAN_LABELS[org?.plan ?? 'starter'] ?? org?.plan ?? 'Starter'}
            </p>
            <Badge variant={org?.plan_status === 'active' ? 'success' : 'secondary'}>
              {org?.plan_status ?? 'trialing'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Abonnement géré par notre équipe. Contactez-nous pour changer de plan.
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
    </div>
  );
}
