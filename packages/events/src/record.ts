import type { SupabaseClient } from '@supabase/supabase-js';
import { createEventEnvelope, isKnownDomainEventType } from './catalog.js';

export interface RecordDomainEventParams {
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string | null;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RecordDomainEventResult {
  ok: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Persist a domain event to Supabase `domain_events` (audit trail).
 * Non-throwing: callers should not fail UX on audit errors.
 * Usable from web (user JWT) and worker (service role).
 */
export async function recordDomainEvent(
  supabase: SupabaseClient,
  params: RecordDomainEventParams
): Promise<RecordDomainEventResult> {
  if (!isKnownDomainEventType(params.eventType)) {
    console.warn(`[audit] unknown domain event type: ${params.eventType}`);
  }

  const event = createEventEnvelope(
    params.eventType,
    params.organizationId,
    params.payload,
    params.actorId ?? undefined,
    {
      source: 'recordDomainEvent',
      ...params.metadata,
    }
  );

  const row: Record<string, unknown> = {
    organization_id: params.organizationId,
    event_type: event.eventType,
    event_version: event.version,
    aggregate_type: params.aggregateType,
    aggregate_id: params.aggregateId,
    actor_id: params.actorId ?? null,
    payload: event.payload,
    metadata: {
      ...event.metadata,
      eventId: event.eventId,
      occurredAt: event.occurredAt,
    },
    event_id: event.eventId,
  };

  const { error } = await supabase.from('domain_events').insert(row);

  if (error) {
    if (/event_id/i.test(error.message)) {
      delete row.event_id;
      const retry = await supabase.from('domain_events').insert(row);
      if (retry.error) {
        console.warn('[audit] domain_events insert failed:', retry.error.message);
        return { ok: false, error: retry.error.message };
      }
      return { ok: true, eventId: event.eventId };
    }
    console.warn('[audit] domain_events insert failed:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, eventId: event.eventId };
}
