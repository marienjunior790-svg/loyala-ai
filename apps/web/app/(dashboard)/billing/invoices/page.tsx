import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { listInvoices, formatFcfa } from '@loyala/domain-billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

export default async function BillingInvoicesPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  let invoices: Awaited<ReturnType<typeof listInvoices>> = [];
  let error: string | null = null;
  try {
    invoices = await listInvoices(supabase, ctx.organizationId);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Factures indisponibles';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Factures</h2>
          <p className="mt-1 text-sm text-muted-foreground">Snapshots locaux après paiement réussi</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/billing">← Abonnement</Link>
        </Button>
      </div>

      {error && <ModuleError message={error} />}

      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {invoices.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune facture.</p>
          )}
          {invoices.map((inv) => (
            <div
              key={String(inv.id)}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2 text-sm last:border-0"
            >
              <div>
                <p className="font-medium">{String(inv.number)}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.plan_code} · {formatFcfa(Number(inv.amount))} ·{' '}
                  {new Date(String(inv.issued_at)).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <Badge variant="success">{String(inv.status)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
