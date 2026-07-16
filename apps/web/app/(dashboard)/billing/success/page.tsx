import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string }>;
}) {
  await requireAuth();
  const { paymentId } = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Paiement initié</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Validez la demande sur votre téléphone Mobile Money. L&apos;abonnement sera activé
            après confirmation OpenPay (webhook ou polling).
          </p>
          {paymentId && (
            <p>
              Réf. paiement : <code className="text-xs">{paymentId}</code>
            </p>
          )}
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/billing">Voir l&apos;abonnement</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/billing/history">Historique</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
