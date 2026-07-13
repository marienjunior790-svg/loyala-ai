import { describe, expect, it } from 'vitest';
import { resolveTemplateCatalog } from './template-catalog';
import { routeOutboundMessage, routeWhatsAppWithSession } from './router';
import type { MessagingContext, OutboundMessage } from './types';

const baseMessage = (overrides: Partial<OutboundMessage> = {}): OutboundMessage => ({
  organizationId: 'org-1',
  clientId: 'client-1',
  channel: 'whatsapp',
  body: 'Bonjour Marie !\n\nCette semaine nous vous offrons un dessert.\n\nÀ bientôt chez Restaurant Soleil.',
  phone: '065719922',
  optIn: true,
  intent: 'inactive',
  metadata: {
    clientName: 'Marie Dupont',
    restaurantName: 'Restaurant Soleil',
  },
  ...overrides,
});

const context = (apiEnabled = true): MessagingContext => ({
  apiEnabled,
  templateCatalog: resolveTemplateCatalog(),
  getSession: async () => ({
    organizationId: 'org-1',
    clientId: 'client-1',
    channel: 'whatsapp',
    sessionOpen: false,
  }),
});

describe('routeOutboundMessage', () => {
  it('skips when opt-out', async () => {
    const decision = await routeOutboundMessage(
      baseMessage({ optIn: false }),
      context()
    );
    expect(decision.mode).toBe('skipped');
    expect(decision.skipReason).toBe('opt_out');
  });

  it('returns deep_link when API disabled', async () => {
    const decision = await routeOutboundMessage(baseMessage(), context(false));
    expect(decision.mode).toBe('deep_link');
  });

  it('returns api_template when session closed and catalog matches intent', () => {
    const decision = routeWhatsAppWithSession(baseMessage(), context(), false);
    expect(decision.mode).toBe('api_template');
    expect(decision.template?.intent).toBe('inactive');
  });

  it('returns api_text when session open', () => {
    const decision = routeWhatsAppWithSession(baseMessage(), context(), true);
    expect(decision.mode).toBe('api_text');
  });

  it('returns deep_link when intent has no approved template', () => {
    const decision = routeWhatsAppWithSession(
      baseMessage({ intent: 'reply' }),
      context(),
      false
    );
    expect(decision.mode).toBe('deep_link');
  });
});
