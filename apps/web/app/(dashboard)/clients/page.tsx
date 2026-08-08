import { requireAuthPermission } from '@/lib/auth/guard';
import { canWriteClients } from '@/lib/auth/clients-access';
import { createClient } from '@/lib/supabase/server';
import {
  listClients,
  syncClientSegments,
  getAcquisitionStats,
  listPendingWhatsAppLeads,
  getOrganization,
  isClientInactive,
} from '@loyala/domain-crm';
import { Card, CardContent } from '@/components/ui/card';
import { ClientsList } from '@/components/clients/clients-list';
import { ClientsAcquisitionShell } from '@/components/clients/clients-acquisition-shell';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const ctx = await requireAuthPermission('clients:read');
  const canWrite = canWriteClients(ctx);
  const { segment: initialSegment } = await searchParams;

  const supabase = await createClient();

  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let loadError: string | null = null;
  let stats = {
    newThisWeek: 0,
    newThisMonth: 0,
    whatsappClients: 0,
    toRelaunch: 0,
    pendingLeads: 0,
    primarySource: null as string | null,
    bySource: [] as { source: string; count: number }[],
  };
  let leads: Awaited<ReturnType<typeof listPendingWhatsAppLeads>> = [];
  let whatsappPhone = '';
  let phoneNumberId = '';

  try {
    clients = await listClients(supabase, ctx.organizationId);
    await syncClientSegments(supabase, ctx.organizationId, clients);
    clients = await listClients(supabase, ctx.organizationId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Impossible de charger les clients';
    console.error('[clients] listClients failed', { organizationId: ctx.organizationId, loadError });
  }

  try {
    const inactiveIds = clients.filter((c) => isClientInactive(c)).map((c) => c.id);
    stats = await getAcquisitionStats(supabase, ctx.organizationId, {
      inactiveClientIds: inactiveIds,
    });
    leads = await listPendingWhatsAppLeads(supabase, ctx.organizationId, 20);
  } catch (error) {
    console.warn('[clients] acquisition stats/leads unavailable', error);
  }

  try {
    const org = await getOrganization(supabase, ctx.organizationId);
    const settings = (org?.settings as Record<string, unknown>) ?? {};
    whatsappPhone = String(settings.whatsapp_phone ?? '');
    phoneNumberId = String(settings.whatsapp_phone_number_id ?? '');
  } catch {
    /* ignore */
  }

  const apiConfigured = Boolean(
    phoneNumberId.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );

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

      <ClientsAcquisitionShell
        canWrite={canWrite}
        stats={stats}
        leads={leads}
        whatsappPhone={whatsappPhone}
        phoneNumberId={phoneNumberId}
        apiConfigured={apiConfigured}
      />

      <ClientsList clients={clients} canWrite={canWrite} initialSegment={initialSegment ?? null} />
    </div>
  );
}
