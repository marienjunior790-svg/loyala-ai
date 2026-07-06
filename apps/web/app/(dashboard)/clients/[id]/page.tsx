import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { requireAuthPermission } from '@/lib/auth/guard';
import { hasPermission } from '@loyala/core-iam';
import { createClient } from '@/lib/supabase/server';
import { getClient } from '@loyala/domain-crm';
import { DeleteClientButton } from './delete-client-button';
import { WhatsAppRelaunchButton } from '@/components/clients/whatsapp-relaunch-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === 'new' || id === 'create' || id === 'ajouter') {
    redirect('/clients?nouveau=1');
  }

  const ctx = await requireAuthPermission('clients:read');
  const canWrite = hasPermission(ctx, 'clients:write');
  const canDelete = hasPermission(ctx, 'clients:delete');

  const supabase = await createClient();
  const client = await getClient(supabase, ctx.organizationId, id);

  if (!client) notFound();

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
        {canWrite && (
          <div className="flex flex-wrap gap-2">
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
          </div>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          {client.email && (
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-1 text-sm">{client.email}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Visites</p>
            <p className="mt-1 text-sm">{client.visit_count}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">WhatsApp</p>
            <p className="mt-1 text-sm">{client.opt_in_whatsapp ? 'Opt-in' : 'Non opt-in'}</p>
          </div>
          {client.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm">{client.notes}</p>
            </div>
          )}
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
