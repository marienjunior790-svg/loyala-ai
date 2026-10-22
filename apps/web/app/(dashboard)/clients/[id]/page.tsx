import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, History, Pencil } from 'lucide-react';
import { requireAuthPermission } from '@/lib/auth/guard';
import { canWriteClients, canDeleteClients, canRefundOrder } from '@/lib/auth/clients-access';
import { hasPermission } from '@loyala/core-iam';
import { createClient } from '@/lib/supabase/server';
import {
  getClient,
  listClientPurchases,
  listCatalogItems,
  computeClientPurchaseInsights,
  getItemOptions,
  getWhatsAppConnectionPublic,
  getOrganization,
  computeClientProfile,
  getClientSpendRank,
  WHATSAPP_CONSENT_LABELS,
} from '@loyala/domain-crm';
import { DeleteClientButton } from './delete-client-button';
import { WhatsAppRelaunchButton } from '@/components/clients/whatsapp-relaunch-button';
import { RecordVisitDialog } from '@/components/clients/record-visit-dialog';
import { ClientHistorySection } from '@/components/clients/client-history-section';
import { ClientCrmInsights } from '@/components/clients/client-crm-insights';
import { SpendChart } from '@/components/clients/dashboard/spend-chart';
import { ProductBars } from '@/components/clients/dashboard/clients-dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/clients/money';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === 'new' || id === 'create' || id === 'ajouter') {
    redirect('/clients/ajouter');
  }

  const ctx = await requireAuthPermission('clients:read');
  const canWrite = canWriteClients(ctx);
  const canDelete = canDeleteClients(ctx);
  const canManageOrders = hasPermission(ctx, 'orders:manage');
  const canRefund = canRefundOrder(ctx);

  const supabase = await createClient();
  const client = await getClient(supabase, ctx.organizationId, id);

  if (!client) notFound();

  const [visits, catalogItems, connection, org, spendRank] = await Promise.all([
    listClientPurchases(supabase, ctx.organizationId, id),
    listCatalogItems(supabase, ctx.organizationId, { activeOnly: true }),
    getWhatsAppConnectionPublic(supabase, ctx.organizationId),
    getOrganization(supabase, ctx.organizationId).catch(() => null),
    getClientSpendRank(supabase, ctx.organizationId, Number(client.total_spent ?? 0)).catch(() => null),
  ]);
  const currency = org?.currency ?? 'XOF';
  const timezone = org?.timezone ?? 'Africa/Dakar';
  const insights = computeClientPurchaseInsights(visits);
  const profile = computeClientProfile({ visits, now: new Date(), timezone });
  const monthPoints = profile.months.map((point) => ({
    key: point.key,
    label: point.label,
    title: new Date(`${point.key}-01T00:00:00Z`).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    spent: point.spent,
    visits: point.visits,
  }));
  const whatsappReady = connection.isReady;
  const pickerItems = catalogItems.map((i) => ({
    id: i.id,
    name: i.name,
    price: Number(i.price),
    currency: i.currency,
    type: i.type,
    categoryName: i.catalog_categories?.name ?? null,
    options: getItemOptions(i),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/clients">
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{client.full_name}</h2>
            <Badge variant="secondary" className="capitalize">
              {client.segment}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {client.phone}
            {client.phone_e164 && client.phone_e164 !== client.phone ? (
              <span title="Format international utilisé pour WhatsApp"> · {client.phone_e164}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/clients/${client.id}/historique`}>
              <History className="h-4 w-4" />
              Historique CRM
            </Link>
          </Button>
          {canWrite && (
            <>
              <RecordVisitDialog
                clientId={client.id}
                clientName={client.full_name}
                catalogItems={pickerItems}
                timeZone={timezone}
              />
              {client.opt_in_whatsapp && (
                <WhatsAppRelaunchButton
                  clientId={client.id}
                  phone={client.phone}
                  clientName={client.full_name}
                  whatsappReady={whatsappReady}
                />
              )}
              <Button variant="outline" asChild>
                <Link href={`/clients/${client.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {client.email && (
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-1 text-sm">{client.email}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Commandes payées</p>
            <p className="mt-1 text-sm font-medium">{client.visit_count}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dépenses totales</p>
            <p className="mt-1 text-sm font-medium">{formatMoney(Number(client.total_spent), currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Classement</p>
            <p className="mt-1 text-sm font-medium">
              {spendRank?.rank ? `${spendRank.rank}ᵉ sur ${spendRank.ranked.toLocaleString('fr-FR')} clients` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dernière visite</p>
            <p className="mt-1 text-sm">{formatDateTime(client.last_visit_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date de naissance</p>
            <p className="mt-1 text-sm">{formatDateTime(client.date_of_birth)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">WhatsApp</p>
            <p className="mt-1 text-sm">
              {WHATSAPP_CONSENT_LABELS[client.whatsapp_consent] ?? '—'}
              {client.whatsapp_consent_at && (
                <span className="text-muted-foreground">
                  {' '}
                  · {new Date(client.whatsapp_consent_at).toLocaleDateString('fr-FR')}
                </span>
              )}
            </p>
          </div>
          {client.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Dépenses sur 12 mois</CardTitle>
            <CardDescription>Survolez un mois pour voir le détail</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendChart points={monthPoints} currency={currency} totalLabel="Total sur 12 mois" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Ses plats préférés</CardTitle>
            <CardDescription>Depuis son premier passage</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.topProducts.length > 0 ? (
              <ProductBars products={profile.topProducts.slice(0, 5)} currency={currency} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun plat enregistré pour ce client pour l’instant.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Intelligence CRM</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientCrmInsights insights={insights} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientHistorySection
            clientId={client.id}
            visits={visits}
            canWrite={canWrite}
            canManageOrders={canManageOrders}
            canRefund={canRefund}
            currentUserId={ctx.userId}
          />
        </CardContent>
      </Card>

      {canDelete && (
        <div className="pt-2">
          <DeleteClientButton clientId={client.id} />
        </div>
      )}
    </div>
  );
}
