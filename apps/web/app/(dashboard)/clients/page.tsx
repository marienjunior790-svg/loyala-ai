import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAuthPermission, canManageClients } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { listClients } from '@loyala/domain-crm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ClientsList } from '@/components/clients/clients-list';
import { WelcomeBanner } from '@/components/clients/welcome-banner';
import { NewClientForm } from './new/new-client-form';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string; welcome?: string }>;
}) {
  const ctx = await requireAuthPermission('clients:read');
  const canWrite = canManageClients(ctx);
  const { nouveau, welcome } = await searchParams;
  const showAddForm = nouveau === '1';

  if (showAddForm) {
    await requireAuthPermission('clients:write');
    const showWelcome = welcome === '1';

    return (
      <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
        {showWelcome && <WelcomeBanner />}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Nouveau client</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez un contact — puis relancez-le sur WhatsApp en 1 clic.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clients">Annuler</Link>
          </Button>
        </div>
        <NewClientForm />
      </div>
    );
  }

  const supabase = await createClient();

  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let loadError: string | null = null;

  try {
    clients = await listClients(supabase, ctx.organizationId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Impossible de charger les clients';
    console.error('[clients] listClients failed', { organizationId: ctx.organizationId, loadError });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {loadError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            <p className="font-medium">Erreur chargement CRM</p>
            <p className="mt-1 font-mono text-xs">{loadError}</p>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Relancez vos clients inactifs en 1 clic via WhatsApp
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/clients?nouveau=1">
              <Plus className="h-4 w-4" />
              Ajouter un client
            </Link>
          </Button>
        )}
      </div>

      <ClientsList clients={clients} canWrite={canWrite} />
    </div>
  );
}
