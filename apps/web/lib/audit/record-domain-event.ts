import type { SupabaseClient } from '@supabase/supabase-js';
import { createEventEnvelope } from '@loyala/events';

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
  const event = createEventEnvelope(
    params.eventType,
    params.organizationId,
    params.payload,
    params.actorId
  );

  const { error } = await supabase.from('domain_events').insert({
    organization_id: params.organizationId,
    event_type: event.eventType,
    event_version: event.version,
    aggregate_type: params.aggregateType,
    aggregate_id: params.aggregateId,
    actor_id: params.actorId,
    payload: event.payload,
  });

  if (error) throw new Error(error.message);
}
