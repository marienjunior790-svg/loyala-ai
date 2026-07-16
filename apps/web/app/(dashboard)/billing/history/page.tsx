import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { listPayments, formatFcfa } from '@loyala/domain-billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

export default async function BillingHistoryPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  let payments: Awaited<ReturnType<typeof listPayments>> = [];
  let error: string | null = null;
  try {
    payments = await listPayments(supabase, ctx.organizationId);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Historique indisponible';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Historique paiements</h2>
          <p className="mt-1 text-sm text-muted-foreground">Transactions OpenPay Congo</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/billing">← Abonnement</Link>
        </Button>
      </div>

      {error && <ModuleError message={error} />}

      <Card>
        <CardHeader>
          <CardTitle>Paiements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun paiement pour le moment.</p>
          )}
          {payments.map((p) => (
            <div
              key={String(p.id)}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2 text-sm last:border-0"
            >
              <div>
                <p className="font-medium">{formatFcfa(Number(p.amount))}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(String(p.created_at)).toLocaleString('fr-FR')}
                  {p.phone ? ` · ${p.phone}` : ''}
                </p>
              </div>
              <Badge variant={p.status === 'succeeded' ? 'success' : 'secondary'}>
                {String(p.status)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
