import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string; provider?: string; change?: string }>;
}) {
  await requireAuth();
  const { paymentId, provider, change } = await searchParams;
  const card = provider === 'stripe';

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>
            {card ? (change ? 'Offre mise à jour' : 'Paiement confirmé') : 'Paiement initié'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {card ? (
            <p>
              {change
                ? 'Votre changement d’offre est enregistré. La différence est calculée au prorata sur votre carte.'
                : 'Merci ! Votre paiement par carte est accepté.'}{' '}
              Votre abonnement s&apos;active dans quelques secondes : actualisez la page Abonnement
              si besoin.
            </p>
          ) : (
            <p>
              Validez la demande sur votre téléphone Mobile Money. L&apos;abonnement sera activé
              dès la confirmation de l&apos;opérateur.
            </p>
          )}
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
