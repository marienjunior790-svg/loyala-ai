import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  ensureDefaultAcquisitionSources,
  getAcquisitionStats,
  getOrganization,
  listClients,
  isClientInactive,
} from '@loyala/domain-crm';
import { CollectClientsClient } from '@/components/clients/collect-clients-client';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function CollecterClientsPage() {
  const ctx = await requireAuthPermission('clients:read');
  const supabase = await createClient();

  try {
    const org = await getOrganization(supabase, ctx.organizationId);
    const settings = (org?.settings as Record<string, unknown>) ?? {};
    const whatsappPhone = String(settings.whatsapp_phone ?? '');
    const restaurantName = org?.name ?? 'Restaurant';

    const sources = await ensureDefaultAcquisitionSources(supabase, ctx.organizationId);
    const clients = await listClients(supabase, ctx.organizationId);
    const inactiveIds = clients.filter((c) => isClientInactive(c)).map((c) => c.id);
    const stats = await getAcquisitionStats(supabase, ctx.organizationId, {
      inactiveClientIds: inactiveIds,
    });

    return (
      <CollectClientsClient
        restaurantName={restaurantName}
        whatsappPhone={whatsappPhone}
        sources={sources}
        stats={stats}
      />
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur chargement';
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-4 text-sm text-destructive">
          <p className="font-medium">Impossible de charger la collecte</p>
          <p className="mt-1 font-mono text-xs">{message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Vérifiez que la migration WhatsApp acquisition (035) a été appliquée sur Supabase.
          </p>
        </CardContent>
      </Card>
    );
  }
}
