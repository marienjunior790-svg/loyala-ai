import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guard';
import { hasPermission } from '@loyala/core-iam';
import { getPlan, formatEur, formatFcfa, type PlanCode } from '@loyala/domain-billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckoutForm } from '@/components/billing/checkout-form';
import {
  PAYMENT_METHODS,
  bankTransferReference,
  isPaymentMethodLive,
} from '@/lib/billing/payment-methods';
import { DEMO_WHATSAPP } from '@/lib/marketing/config';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

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
  const planCode = (params.plan === 'growth' ? 'growth' : 'pro') as PlanCode;
  const plan = getPlan(planCode);
  if (!plan || plan.amountXaf <= 0) redirect('/billing');

  const amountEur = formatEur(plan.amountXaf);
  const reference = bankTransferReference(ctx.organizationId, plan.name);
  const iban = process.env.BANK_TRANSFER_IBAN?.trim() || null;
  const whatsappMessage = iban
    ? `Bonjour, j'ai effectué le virement pour l'abonnement Loyala ${plan.name} (${amountEur}). Référence : ${reference}. Voici la preuve :`
    : `Bonjour, je souhaite payer l'abonnement Loyala ${plan.name} (${amountEur}) par virement bancaire. Référence : ${reference}. Pouvez-vous m'envoyer vos coordonnées bancaires ?`;

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/billing">← Retour</Link>
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight">Paiement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mobile Money, carte bancaire, PayPal ou virement
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{plan.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckoutForm
            planCode={planCode === 'growth' ? 'growth' : 'pro'}
            planName={plan.name}
            amountEur={amountEur}
            amountFcfa={formatFcfa(plan.amountXaf)}
            liveMethods={PAYMENT_METHODS.filter((m) => isPaymentMethodLive(m.id)).map((m) => m.id)}
            bankTransfer={{
              holder: process.env.BANK_TRANSFER_HOLDER?.trim() || null,
              iban,
              bic: process.env.BANK_TRANSFER_BIC?.trim() || null,
              bank: process.env.BANK_TRANSFER_BANK?.trim() || null,
              reference,
              whatsappUrl: buildWhatsAppUrl(DEMO_WHATSAPP, whatsappMessage),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
