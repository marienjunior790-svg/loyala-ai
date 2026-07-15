import { inngest, INNGEST_EVENTS, isInngestConfigured } from '../inngest/client.js';

/** Best-effort bridge: domain_events audit → Inngest for async consumers */
export async function emitDomainEventBridge(params: {
  eventType: string;
  organizationId: string;
  aggregateId: string;
  eventId?: string;
}): Promise<void> {
  if (!isInngestConfigured()) return;

  try {
    await inngest.send({
      name: INNGEST_EVENTS.DOMAIN_EVENT,
      data: {
        eventType: params.eventType,
        organizationId: params.organizationId,
        aggregateId: params.aggregateId,
        eventId: params.eventId,
      },
    });
  } catch (error) {
    console.warn(
      '[domain-events] Inngest bridge failed:',
      error instanceof Error ? error.message : String(error)
    );
  }
}
