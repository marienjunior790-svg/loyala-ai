import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guard';
import { hasPermission } from '@loyala/core-iam';
import { getPlan, formatFcfa, type PlanCode } from '@loyala/domain-billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckoutForm } from '@/components/billing/checkout-form';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'org:settings')) {
    redirect('/billing');
  }

  const params = await searchParams;
  const planCode = (params.plan === 'pro' ? 'pro' : 'growth') as PlanCode;
  const plan = getPlan(planCode);
  if (!plan || plan.amountXaf <= 0) redirect('/billing');

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/billing">← Retour</Link>
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight">Checkout OpenPay</h2>
        <p className="mt-1 text-sm text-muted-foreground">Paiement Mobile Money sécurisé</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{plan.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckoutForm
            planCode={planCode === 'pro' ? 'pro' : 'growth'}
            planName={plan.name}
            amountLabel={formatFcfa(plan.amountXaf)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
