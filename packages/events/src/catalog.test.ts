import { describe, expect, it, vi } from 'vitest';
import {
  createEventEnvelope,
  isKnownDomainEventType,
  recordDomainEvent,
  DOMAIN_EVENT_TYPES,
} from './index';

describe('@loyala/events catalog', () => {
  it('includes CRM and messaging event types', () => {
    expect(DOMAIN_EVENT_TYPES).toContain('client.visit.recorded');
    expect(DOMAIN_EVENT_TYPES).toContain('campaign.scheduled');
    expect(DOMAIN_EVENT_TYPES).toContain('message.received');
  });

  it('validates known types', () => {
    expect(isKnownDomainEventType('client.created')).toBe(true);
    expect(isKnownDomainEventType('billing.paid')).toBe(false);
  });

  it('creates a valid envelope', () => {
    const env = createEventEnvelope('client.created', '11111111-1111-1111-1111-111111111111', {
      fullName: 'Test',
    });
    expect(env.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(env.eventType).toBe('client.created');
    expect(env.version).toBe(1);
  });
});

describe('recordDomainEvent', () => {
  it('inserts with event_id and returns ok', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: vi.fn(() => ({ insert })),
    };

    const result = await recordDomainEvent(supabase as never, {
      organizationId: '11111111-1111-1111-1111-111111111111',
      eventType: 'client.created',
      aggregateType: 'client',
      aggregateId: '22222222-2222-2222-2222-222222222222',
      actorId: '33333333-3333-3333-3333-333333333333',
      payload: { fullName: 'Ada' },
    });

    expect(result.ok).toBe(true);
    expect(result.eventId).toBeTruthy();
    expect(insert).toHaveBeenCalled();
    const row = insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(row.event_id).toBe(result.eventId);
    expect(row.event_type).toBe('client.created');
  });

  it('retries without event_id when column missing', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'column event_id does not exist' } })
      .mockResolvedValueOnce({ error: null });
    const supabase = {
      from: vi.fn(() => ({ insert })),
    };

    const result = await recordDomainEvent(supabase as never, {
      organizationId: '11111111-1111-1111-1111-111111111111',
      eventType: 'message.received',
      aggregateType: 'client',
      aggregateId: '22222222-2222-2222-2222-222222222222',
      payload: { wamid: 'wamid.1' },
    });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(2);
    const second = insert.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(second.event_id).toBeUndefined();
  });
});
