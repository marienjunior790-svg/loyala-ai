import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAuthPermission } from '@/lib/auth/guard';
import { hasPermission } from '@loyala/core-iam';
import { createClient } from '@/lib/supabase/server';
import { listClients } from '@loyala/domain-crm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function ClientsPage() {
  const ctx = await requireAuthPermission('clients:read');
  const canWrite = hasPermission(ctx, 'clients:write');

  const supabase = await createClient();
  const clients = await listClients(supabase, ctx.organizationId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length} client{clients.length !== 1 ? 's' : ''} dans votre CRM
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="h-4 w-4" />
              Nouveau client
            </Link>
          </Button>
        )}
      </div>

      {clients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">Aucun client pour le moment.</p>
            {canWrite && (
              <Button className="mt-4" asChild>
                <Link href="/clients/new">Ajouter votre premier client</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="transition-all hover:border-primary/30 hover:shadow-glow">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{client.full_name}</p>
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {client.segment}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
