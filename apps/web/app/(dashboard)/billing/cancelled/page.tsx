import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function BillingCancelledPage() {
  await requireAuth();
  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Paiement annulé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Aucun débit n&apos;a été effectué.</p>
          <Button asChild>
            <Link href="/billing">Retour aux plans</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
