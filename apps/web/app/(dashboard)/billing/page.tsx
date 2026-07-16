import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getOrganization } from '@loyala/domain-crm';
import {
  BILLING_PLANS,
  formatFcfa,
  getActiveSubscription,
  normalizePlanCode,
} from '@loyala/domain-billing';
import { hasPermission } from '@loyala/core-iam';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const canManage = hasPermission(ctx, 'org:settings');

  let org: Awaited<ReturnType<typeof getOrganization>> = null;
  let subscription: Awaited<ReturnType<typeof getActiveSubscription>> = null;
  let error: string | null = null;

  try {
    org = await getOrganization(supabase, ctx.organizationId);
    try {
      subscription = await getActiveSubscription(supabase, ctx.organizationId);
    } catch {
      /* tables may not exist yet */
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Impossible de charger l'abonnement";
  }

  const planCode = normalizePlanCode(org?.plan);
  const billingEnabled = process.env.BILLING_ENABLED === 'true';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Paiement & abonnement</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            OpenPay Congo — Mobile Money (MTN / Airtel)
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/billing/history">Historique</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/billing/invoices">Factures</Link>
          </Button>
        </div>
      </div>

      {error && <ModuleError message={error} />}

      <Card>
        <CardHeader>
          <CardTitle>Plan actuel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold capitalize">
              {BILLING_PLANS.find((p) => p.code === planCode)?.name ?? planCode}
            </p>
            <Badge variant={org?.plan_status === 'active' ? 'success' : 'secondary'}>
              {org?.plan_status ?? 'trialing'}
            </Badge>
          </div>
          {subscription?.current_period_end && (
            <p className="text-sm text-muted-foreground">
              Période jusqu&apos;au{' '}
              {new Date(String(subscription.current_period_end)).toLocaleDateString('fr-FR')}
            </p>
          )}
          {!billingEnabled && (
            <p className="text-sm text-amber-500">
              Paiements OpenPay non activés en production (`BILLING_ENABLED`).
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
          <Card
            key={plan.code}
            className={
              planCode === plan.code
                ? 'border-primary/40'
                : plan.highlighted
                  ? 'border-primary/20'
                  : ''
            }
          >
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <p className="text-2xl font-bold">
                {plan.amountXaf === 0 ? '0' : formatFcfa(plan.amountXaf).replace(' FCFA', '')}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  {plan.amountXaf === 0 ? '14 jours' : 'FCFA / mois'}
                </span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              {plan.code !== 'trial' && canManage && (
                <Button asChild className="w-full" disabled={!billingEnabled}>
                  <Link href={`/billing/checkout?plan=${plan.code}`}>Choisir {plan.name}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
