import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  listCampaignSends,
  listLatestWhatsAppDeliveryByCampaignSendIds,
  type WhatsAppDeliverySnapshot,
} from '@loyala/domain-crm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ModuleError } from '@/components/dashboard/module-error';
import { MarkRelanceSentButton } from '@/components/relances/mark-sent-button';
import {
  DeliveryStatusTrack,
  ManualSendBadge,
} from '@/components/relances/delivery-status';

export const dynamic = 'force-dynamic';

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarize(sends: Array<{
  status: string;
  delivery?: WhatsAppDeliverySnapshot;
}>) {
  let pending = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;
  for (const s of sends) {
    if (s.delivery?.status === 'read') read += 1;
    else if (s.delivery?.status === 'delivered') delivered += 1;
    else if (s.delivery?.status === 'failed') failed += 1;
    else if (s.status !== 'sent' && !s.delivery) pending += 1;
  }
  return { pending, delivered, read, failed, total: sends.length };
}

export default async function RelancesPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  let sends: Awaited<ReturnType<typeof listCampaignSends>> = [];
  let deliveryBySend = new Map<string, WhatsAppDeliverySnapshot>();
  let error: string | null = null;

  try {
    sends = await listCampaignSends(supabase, ctx.organizationId);
    deliveryBySend = await listLatestWhatsAppDeliveryByCampaignSendIds(
      supabase,
      ctx.organizationId,
      sends.map((s) => s.id)
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur';
  }

  const rows = sends.map((s) => ({
    ...s,
    delivery: deliveryBySend.get(s.id),
  }));
  const summary = summarize(rows);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Relances WhatsApp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Historique des messages, envoi et statut de livraison Meta
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/campaigns">Générer une campagne</Link>
        </Button>
      </div>

      {error && <ModuleError message={error} />}

      {rows.length > 0 && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryStat label="Total" value={summary.total} />
          <SummaryStat label="À envoyer" value={summary.pending} tone="amber" />
          <SummaryStat label="Remis" value={summary.delivered} tone="emerald" />
          <SummaryStat label="Lus" value={summary.read} tone="emerald" />
          <SummaryStat label="Échecs" value={summary.failed} tone="rose" />
        </div>
      )}

      {rows.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Aucune relance enregistrée.</p>
            <Button className="mt-4" asChild>
              <Link href="/campaigns">Créer une campagne IA</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((s) => {
            const client = s.clients as { full_name: string; phone: string } | null;
            const hasMeta = Boolean(s.delivery);
            return (
              <Card key={s.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="font-medium">{client?.full_name ?? 'Client'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCreatedAt(s.created_at)}
                        {client?.phone ? ` · ${client.phone}` : ''}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {s.message_body}
                    </p>
                    {hasMeta && s.delivery ? (
                      <DeliveryStatusTrack delivery={s.delivery} />
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <ManualSendBadge status={s.status} />
                        <span className="text-[11px] text-muted-foreground">
                          Envoi manuel (lien WhatsApp)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {!hasMeta && s.status !== 'sent' && (
                      <MarkRelanceSentButton sendId={s.id} />
                    )}
                    {s.whatsapp_url && !hasMeta && (
                      <Button size="sm" asChild>
                        <a href={s.whatsapp_url} target="_blank" rel="noopener noreferrer">
                          Envoyer
                        </a>
                      </Button>
                    )}
                    {hasMeta && (
                      <span className="text-[11px] text-muted-foreground">Via Meta API</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'amber' | 'emerald' | 'rose';
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={
            tone === 'emerald'
              ? 'mt-1 text-xl font-semibold text-emerald-400'
              : tone === 'amber'
                ? 'mt-1 text-xl font-semibold text-amber-400'
                : tone === 'rose'
                  ? 'mt-1 text-xl font-semibold text-destructive'
                  : 'mt-1 text-xl font-semibold'
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
