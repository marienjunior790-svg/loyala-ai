import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAuthPermission } from '@/lib/auth/guard';
import { hasPermission } from '@loyala/core-iam';
import { createClient } from '@/lib/supabase/server';
import { listClients } from '@loyala/domain-crm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ClientsList } from '@/components/clients/clients-list';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const ctx = await requireAuthPermission('clients:read');
  const canWrite = hasPermission(ctx, 'clients:write');

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
            <Link href="/clients/ajouter">
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
