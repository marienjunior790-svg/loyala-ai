import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityItem } from './types';

const EVENT_LABELS: Record<string, { title: string; type: ActivityItem['type'] }> = {
  'client.created': { title: 'Nouveau client', type: 'client' },
  'client.updated': { title: 'Client modifié', type: 'client' },
  'client.deleted': { title: 'Client supprimé', type: 'client' },
  'organization.created': { title: 'Organisation créée', type: 'client' },
  'member.joined': { title: 'Membre ajouté', type: 'client' },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} j`;
}

export async function getRecentActivity(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ActivityItem[]> {
  const { data: events, error: eventsError } = await supabase
    .from('domain_events')
    .select('id, event_type, payload, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (!eventsError && events && events.length > 0) {
    return events.map((e) => {
      const meta = EVENT_LABELS[String(e.event_type)] ?? {
        title: String(e.event_type),
        type: 'client' as const,
      };
      const payload = e.payload as Record<string, unknown>;
      const name = payload.fullName ? String(payload.fullName) : '';
      return {
        id: String(e.id),
        title: meta.title,
        description: name || String(e.event_type),
        time: formatRelativeTime(String(e.created_at)),
        type: meta.type,
      };
    });
  }

  const { data: sends } = await supabase
    .from('campaign_sends')
    .select('id, message_body, created_at, clients(full_name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (sends && sends.length > 0) {
    return sends.map((s) => {
      const client = s.clients as unknown as { full_name: string } | null;
      return {
        id: String(s.id),
        title: 'Relance WhatsApp',
        description: client?.full_name ?? 'Client',
        time: formatRelativeTime(String(s.created_at)),
        type: 'campaign' as const,
      };
    });
  }

  return [];
}
