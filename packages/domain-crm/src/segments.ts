import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client } from './clients';

/**
 * Seuil d'inactivité — aligné sur @loyala/core-ai detectInactiveClients
 * et apps/worker fetchInactiveClientsForRelaunch (14 jours).
 */
export const INACTIVE_DAYS_THRESHOLD = 14;

export type ClientSegment = 'new' | 'regular' | 'vip' | 'inactive' | 'at_risk';

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/** Dérivation déterministe (sans IA) — valeurs compatibles CHECK segment en DB. */
export function computeClientSegment(client: {
  visit_count: number;
  last_visit_at: string | null;
  total_spent?: number;
  created_at?: string;
}): ClientSegment {
  const visitCount = client.visit_count ?? 0;
  const lastVisit = client.last_visit_at;
  const totalSpent = Number(client.total_spent ?? 0);

  if (visitCount > 0 && totalSpent >= 500_000 && lastVisit && daysSince(lastVisit) < INACTIVE_DAYS_THRESHOLD) {
    return 'vip';
  }

  if (!lastVisit) {
    if (visitCount === 0) {
      if (client.created_at && daysSince(client.created_at) >= INACTIVE_DAYS_THRESHOLD) {
        return 'at_risk';
      }
      return 'new';
    }
    return 'at_risk';
  }

  const daysInactive = daysSince(lastVisit);
  if (daysInactive >= INACTIVE_DAYS_THRESHOLD) {
    return visitCount >= 3 ? 'inactive' : 'at_risk';
  }

  if (visitCount > 0) return 'regular';
  return 'new';
}

export function isInactiveSegment(segment: string): boolean {
  return segment === 'inactive' || segment === 'at_risk';
}

export function isClientInactive(client: {
  segment: string;
  visit_count: number;
  last_visit_at: string | null;
  total_spent?: number;
  created_at?: string;
}): boolean {
  return isInactiveSegment(computeClientSegment(client));
}

/** Persiste les segments calculés lorsque la colonne DB est obsolète. */
export async function syncClientSegments(
  supabase: SupabaseClient,
  organizationId: string,
  clients: Client[]
): Promise<void> {
  const stale = clients.filter((c) => c.segment !== computeClientSegment(c));
  if (stale.length === 0) return;

  await Promise.all(
    stale.map((c) => {
      const segment = computeClientSegment(c);
      return supabase
        .from('clients')
        .update({ segment })
        .eq('id', c.id)
        .eq('organization_id', organizationId);
    })
  );
}
