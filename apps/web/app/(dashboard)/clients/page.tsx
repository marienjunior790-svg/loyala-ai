import Link from 'next/link';
import { Contact, LayoutDashboard } from 'lucide-react';
import { requireAuthPermission } from '@/lib/auth/guard';
import { canWriteClients } from '@/lib/auth/clients-access';
import { createClient } from '@/lib/supabase/server';
import {
  listAllClients,
  syncClientSegments,
  getAcquisitionStats,
  listPendingWhatsAppLeads,
  getOrganization,
  isClientInactive,
  getWhatsAppConnectionPublic,
  getClientDashboard,
  parseDashboardPeriod,
  type ClientDashboard,
} from '@loyala/domain-crm';
import { Card, CardContent } from '@/components/ui/card';
import { ClientsList } from '@/components/clients/clients-list';
import { ClientsAcquisitionShell } from '@/components/clients/clients-acquisition-shell';
import { ClientsDashboard, PeriodSelector } from '@/components/clients/dashboard/clients-dashboard';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type ClientsView = 'tableau' | 'fichier';

function ViewTabs({ view, clientCount }: { view: ClientsView; clientCount: number }) {
  const tabs = [
    { id: 'tableau' as const, label: 'Tableau de bord', href: '/clients', icon: LayoutDashboard },
    { id: 'fichier' as const, label: `Fichier clients (${clientCount.toLocaleString('fr-FR')})`, href: '/clients?vue=fichier', icon: Contact },
  ];
  return (
    <nav className="flex gap-1 border-b border-white/[0.08]" aria-label="Vues clients">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === view ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition',
              tab.id === view
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; vue?: string; periode?: string }>;
}) {
  const ctx = await requireAuthPermission('clients:read');
  const canWrite = canWriteClients(ctx);
  const { segment: initialSegment, vue, periode } = await searchParams;
  const view: ClientsView = vue === 'fichier' || (vue !== 'tableau' && initialSegment) ? 'fichier' : 'tableau';
  const period = parseDashboardPeriod(periode);

  const supabase = await createClient();

  let clients: Awaited<ReturnType<typeof listAllClients>> = [];
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
  let whatsappReady = false;
  let timezone = 'Africa/Dakar';
  let currency = 'XOF';
  let dashboard: ClientDashboard | null = null;
  let dashboardError: string | null = null;

  try {
    clients = await listAllClients(supabase, ctx.organizationId);
    await syncClientSegments(supabase, ctx.organizationId, clients);
    clients = await listAllClients(supabase, ctx.organizationId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Impossible de charger les clients';
    console.error('[clients] listClients failed', { organizationId: ctx.organizationId, loadError });
  }

  try {
    const org = await getOrganization(supabase, ctx.organizationId);
    timezone = org?.timezone ?? timezone;
    currency = org?.currency ?? currency;
    const settings = (org?.settings as Record<string, unknown>) ?? {};
    const connection = await getWhatsAppConnectionPublic(supabase, ctx.organizationId);
    whatsappReady = connection.isReady;
    whatsappPhone = connection.displayPhone || String(settings.whatsapp_phone ?? '');
    phoneNumberId = connection.phoneNumberId || String(settings.whatsapp_phone_number_id ?? '');
  } catch {
    /* ignore */
  }

  if (!loadError) {
    try {
      dashboard = await getClientDashboard(supabase, ctx.organizationId, { clients, period, timezone });
    } catch (error) {
      dashboardError = error instanceof Error ? error.message : 'Impossible de calculer le tableau de bord';
      console.error('[clients] dashboard failed', { organizationId: ctx.organizationId, dashboardError });
    }
  }

  if (view === 'fichier') {
    try {
      const inactiveIds = clients.filter((c) => isClientInactive(c)).map((c) => c.id);
      stats = await getAcquisitionStats(supabase, ctx.organizationId, {
        inactiveClientIds: inactiveIds,
      });
      leads = await listPendingWhatsAppLeads(supabase, ctx.organizationId, 20);
    } catch (error) {
      console.warn('[clients] acquisition stats/leads unavailable', error);
    }
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

      <ClientsAcquisitionShell
        canWrite={canWrite}
        stats={stats}
        leads={leads}
        whatsappPhone={whatsappPhone}
        phoneNumberId={phoneNumberId}
        apiConfigured={whatsappReady}
        showAcquisition={view === 'fichier'}
      />

      <ViewTabs view={view} clientCount={clients.length} />

      {view === 'tableau' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Qui vient, combien il dépense et ce qu’il commande.
            </p>
            <PeriodSelector period={period} />
          </div>
          {dashboardError && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 text-sm text-destructive">
                <p className="font-medium">Tableau de bord indisponible</p>
                <p className="mt-1 font-mono text-xs">{dashboardError}</p>
              </CardContent>
            </Card>
          )}
          {dashboard &&
            (clients.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Ajoutez vos premiers clients et enregistrez leurs commandes : leur classement, leurs dépenses et
                  leurs plats préférés apparaîtront ici.
                </CardContent>
              </Card>
            ) : (
              <ClientsDashboard dashboard={dashboard} currency={currency} />
            ))}
        </div>
      ) : (
        <ClientsList
          clients={clients}
          canWrite={canWrite}
          initialSegment={initialSegment ?? null}
          whatsappReady={whatsappReady}
          stats={dashboard?.perClient ?? {}}
          currency={currency}
          timezone={timezone}
        />
      )}
    </div>
  );
}
