import type { SupabaseClient } from '@supabase/supabase-js';
import { listClients, syncClientSegments, isClientInactive } from '@loyala/domain-crm';
import type { KpiMetric } from './types';

export async function getCrmKpis(
  supabase: SupabaseClient,
  organizationId: string
): Promise<KpiMetric[]> {
  let clients: Awaited<ReturnType<typeof listClients>> = [];

  try {
    clients = await listClients(supabase, organizationId);
    await syncClientSegments(supabase, organizationId, clients);
    clients = await listClients(supabase, organizationId);
  } catch {
    return fallbackKpis();
  }

  const total = clients.length;
  const inactive = clients.filter((c) => isClientInactive(c)).length;
  const active = total - inactive;
  const estimatedRevenue = clients.reduce((sum, c) => sum + Number(c.total_spent ?? 0), 0);

  return [
    {
      id: 'crm-total',
      label: 'Clients totaux',
      value: String(total),
      change: 0,
      changeLabel: 'dans votre CRM',
      trend: 'up',
    },
    {
      id: 'crm-active',
      label: 'Clients actifs',
      value: String(active),
      change: total > 0 ? Math.round((active / total) * 100) : 0,
      changeLabel: '% du fichier',
      trend: 'up',
    },
    {
      id: 'crm-inactive',
      label: 'À relancer',
      value: String(inactive),
      change: 0,
      changeLabel: 'opportunités WhatsApp',
      trend: inactive > 0 ? 'down' : 'up',
    },
    {
      id: 'crm-revenue',
      label: 'Revenus suivis',
      value: formatXof(estimatedRevenue),
      change: 0,
      changeLabel: 'total historique CRM',
      trend: 'up',
    },
  ];
}

function formatXof(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M XOF`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k XOF`;
  return `${Math.round(amount)} XOF`;
}

function fallbackKpis(): KpiMetric[] {
  return [
    { id: 'crm-total', label: 'Clients totaux', value: '—', change: 0, changeLabel: 'chargement', trend: 'up' },
    { id: 'crm-active', label: 'Clients actifs', value: '—', change: 0, changeLabel: 'chargement', trend: 'up' },
    { id: 'crm-inactive', label: 'À relancer', value: '—', change: 0, changeLabel: 'chargement', trend: 'up' },
    { id: 'crm-revenue', label: 'Revenus suivis', value: '—', change: 0, changeLabel: 'chargement', trend: 'up' },
  ];
}
