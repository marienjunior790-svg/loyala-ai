import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getClient, getClientHistory } from '@loyala/domain-crm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClientHistoryTimeline } from '@/components/clients/client-history-timeline';

export const dynamic = 'force-dynamic';

export default async function ClientHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthPermission('clients:read');
  const supabase = await createClient();

  const client = await getClient(supabase, ctx.organizationId, id);
  if (!client) notFound();

  const events = await getClientHistory(supabase, ctx.organizationId, client, ctx.userId);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/clients/${client.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Retour à la fiche client
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Historique CRM</h2>
            <Badge variant="secondary" className="capitalize">
              {client.segment}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {client.full_name} · Chronologie complète, du plus récent au plus ancien
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chronologie des activités</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientHistoryTimeline events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
