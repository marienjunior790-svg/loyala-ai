import { describe, expect, it, vi } from 'vitest';
import { deliverWhatsApp } from './whatsapp';
import { resolveTemplateCatalog } from '../template-catalog';
import type { OutboundMessage } from '../types';

const message: OutboundMessage = {
  organizationId: 'org-1',
  clientId: 'client-1',
  campaignSendId: 'send-1',
  channel: 'whatsapp',
  body: 'Bonjour Jean !\n\nRevenez nous voir cette semaine.\n\nÀ bientôt chez Le Bistrot.',
  phone: '065719922',
  optIn: true,
  intent: 'inactive',
  metadata: {
    clientName: 'Jean Test',
    restaurantName: 'Le Bistrot',
  },
};

describe('deliverWhatsApp', () => {
  it('sends api_template with mapped variables', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      provider: 'meta',
      wamid: 'wamid.123',
      status: 'sent',
      phone: '24265719922',
      raw: {},
    });

    const result = await deliverWhatsApp(
      message,
      {
        apiEnabled: true,
        templateCatalog: resolveTemplateCatalog({ templateName: 'loyala_inactive_v1' }),
        getSession: async () => ({
          organizationId: 'org-1',
          clientId: 'client-1',
          channel: 'whatsapp',
          sessionOpen: false,
        }),
      },
      {
        sendMessage,
        getConfig: () => ({
          accessToken: 'token',
          phoneNumberId: '123',
          apiVersion: 'v21.0',
        }),
      }
    );

    expect(result.status).toBe('sent');
    expect(result.mode).toBe('api_template');
    expect(result.externalId).toBe('wamid.123');
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'template',
        templateName: 'loyala_inactive_v1',
        templateVariables: expect.arrayContaining(['Jean']),
      })
    );
  });

  it('sends api_text when session is open', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      provider: 'meta',
      wamid: 'wamid.456',
      status: 'sent',
      phone: '24265719922',
      raw: {},
    });

    const result = await deliverWhatsApp(
      message,
      {
        apiEnabled: true,
        templateCatalog: resolveTemplateCatalog(),
        getSession: async () => ({
          organizationId: 'org-1',
          clientId: 'client-1',
          channel: 'whatsapp',
          sessionOpen: true,
        }),
      },
      {
        sendMessage,
        getConfig: () => ({
          accessToken: 'token',
          phoneNumberId: '123',
          apiVersion: 'v21.0',
        }),
      }
    );

    expect(result.mode).toBe('api_text');
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text',
        body: message.body,
      })
    );
  });

  it('returns deep_link fallback when API disabled', async () => {
    const result = await deliverWhatsApp(message, {
      apiEnabled: false,
      templateCatalog: resolveTemplateCatalog(),
      getSession: async () => null,
    });

    expect(result.mode).toBe('deep_link');
    expect(result.deepLinkUrl).toContain('wa.me');
    expect(result.deepLinkUrl).toContain(encodeURIComponent('Revenez'));
  });
});
