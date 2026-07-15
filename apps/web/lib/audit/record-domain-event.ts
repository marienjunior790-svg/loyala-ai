import type { SupabaseClient } from '@supabase/supabase-js';
import { recordDomainEvent as record } from '@loyala/events';

/** @deprecated Prefer `recordDomainEvent` from `@loyala/events` */
export async function recordDomainEvent(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    actorId: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  await record(supabase, params);
}
