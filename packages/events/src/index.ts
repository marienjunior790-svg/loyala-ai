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

/** P0 domain events — Sprint 0 catalog (no consumers yet) */
export const P0_EVENT_TYPES = [
  'organization.created',
  'member.joined',
  'client.created',
  'client.updated',
  'client.deleted',
  'campaign.send.requested',
  'message.received',
] as const;

export type P0EventType = (typeof P0_EVENT_TYPES)[number];

export function createEventEnvelope(
  eventType: string,
  organizationId: string | null,
  payload: Record<string, unknown>,
  actorId?: string
): EventEnvelope {
  return {
    eventId: randomUUID(),
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    organizationId,
    actorId,
    payload,
  };
}
