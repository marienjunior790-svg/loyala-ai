import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, History, Pencil } from 'lucide-react';
import { requireAuthPermission } from '@/lib/auth/guard';
import { canWriteClients, canDeleteClients } from '@/lib/auth/clients-access';
import { createClient } from '@/lib/supabase/server';
import {
  getClient,
  listClientPurchases,
  listCatalogItems,
  computeClientPurchaseInsights,
} from '@loyala/domain-crm';
import { DeleteClientButton } from './delete-client-button';
import { WhatsAppRelaunchButton } from '@/components/clients/whatsapp-relaunch-button';
import { RecordVisitDialog } from '@/components/clients/record-visit-dialog';
import { ClientHistorySection } from '@/components/clients/client-history-section';
import { ClientCrmInsights } from '@/components/clients/client-crm-insights';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatXof(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} XOF`;
}

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

  const supabase = await createClient();
  const client = await getClient(supabase, ctx.organizationId, id);

  if (!client) notFound();

  const [visits, catalogItems] = await Promise.all([
    listClientPurchases(supabase, ctx.organizationId, id),
    listCatalogItems(supabase, ctx.organizationId, { activeOnly: true }),
  ]);
  const insights = computeClientPurchaseInsights(visits);
  const pickerItems = catalogItems.map((i) => ({
    id: i.id,
    name: i.name,
    price: Number(i.price),
    currency: i.currency,
    type: i.type,
    categoryName: i.catalog_categories?.name ?? null,
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
          <p className="mt-1 text-sm text-muted-foreground">{client.phone}</p>
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
              />
              {client.opt_in_whatsapp && (
                <WhatsAppRelaunchButton
                  phone={client.phone}
                  clientName={client.full_name}
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
            <p className="text-xs text-muted-foreground">Visites</p>
            <p className="mt-1 text-sm font-medium">{client.visit_count}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dépenses totales</p>
            <p className="mt-1 text-sm font-medium">{formatXof(Number(client.total_spent))}</p>
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
            <p className="mt-1 text-sm">{client.opt_in_whatsapp ? 'Opt-in' : 'Non opt-in'}</p>
          </div>
          {client.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
