import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../inngest/client.js', () => ({
  inngest: { send: vi.fn(async () => undefined) },
  INNGEST_EVENTS: { DOMAIN_EVENT: 'loyala/domain.event' },
  isInngestConfigured: vi.fn(() => true),
}));

import { emitDomainEventBridge } from './bridge';
import { inngest, isInngestConfigured } from '../inngest/client.js';

describe('emitDomainEventBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isInngestConfigured).mockReturnValue(true);
  });

  it('sends loyala/domain.event when Inngest is configured', async () => {
    await emitDomainEventBridge({
      eventType: 'message.received',
      organizationId: '11111111-1111-1111-1111-111111111111',
      aggregateId: '22222222-2222-2222-2222-222222222222',
      eventId: '33333333-3333-3333-3333-333333333333',
    });

    expect(inngest.send).toHaveBeenCalledWith({
      name: 'loyala/domain.event',
      data: {
        eventType: 'message.received',
        organizationId: '11111111-1111-1111-1111-111111111111',
        aggregateId: '22222222-2222-2222-2222-222222222222',
        eventId: '33333333-3333-3333-3333-333333333333',
      },
    });
  });

  it('no-ops when Inngest is not configured', async () => {
    vi.mocked(isInngestConfigured).mockReturnValue(false);
    await emitDomainEventBridge({
      eventType: 'message.received',
      organizationId: '11111111-1111-1111-1111-111111111111',
      aggregateId: '22222222-2222-2222-2222-222222222222',
    });
    expect(inngest.send).not.toHaveBeenCalled();
  });
});
