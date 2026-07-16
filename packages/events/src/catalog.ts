import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/** Standard event envelope — Blueprint §5 */
export const eventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  version: z.number().int().min(1),
  occurredAt: z.string().datetime(),
  organizationId: z.string().uuid().nullable(),
  actorId: z.string().uuid().optional(),
  payload: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

/**
 * Domain event catalog (audit + future Inngest bridge).
 * Keep in sync with activity feed labels and emit sites.
 */
export const DOMAIN_EVENT_TYPES = [
  'organization.created',
  'member.joined',
  'client.created',
  'client.updated',
  'client.deleted',
  'client.visit.recorded',
  'client.expense.recorded',
  'campaign.created',
  'campaign.send.requested',
  'campaign.scheduled',
  'message.received',
  'subscription.updated',
  'payment.succeeded',
  'payment.failed',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

/** @deprecated Use DOMAIN_EVENT_TYPES — kept for worker health compatibility */
export const P0_EVENT_TYPES = DOMAIN_EVENT_TYPES;

export type P0EventType = DomainEventType;

const DOMAIN_EVENT_SET = new Set<string>(DOMAIN_EVENT_TYPES);

export function isKnownDomainEventType(eventType: string): eventType is DomainEventType {
  return DOMAIN_EVENT_SET.has(eventType);
}

export function createEventEnvelope(
  eventType: string,
  organizationId: string | null,
  payload: Record<string, unknown>,
  actorId?: string,
  metadata?: Record<string, unknown>
): EventEnvelope {
  return {
    eventId: randomUUID(),
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    organizationId,
    actorId,
    payload,
    metadata,
  };
}
