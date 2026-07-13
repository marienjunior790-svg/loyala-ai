import { deliverWhatsApp } from './adapters/whatsapp';
import type { DeliveryResult, MessageIntent, MessagingContext, OutboundMessage } from './types';

export async function deliverOutboundMessage(
  message: OutboundMessage,
  context: MessagingContext
): Promise<DeliveryResult> {
  switch (message.channel) {
    case 'whatsapp':
      return deliverWhatsApp(message, context);
    default:
      return {
        channel: message.channel,
        mode: 'skipped',
        status: 'skipped',
        skipReason: 'channel_not_implemented',
        messageBody: message.body,
      };
  }
}

export function campaignTypeToIntent(type: string): MessageIntent {
  switch (type) {
    case 'birthday':
      return 'birthday';
    case 'inactive':
      return 'inactive';
    case 'loyalty':
      return 'loyalty';
    case 'promotion':
    case 'promo':
      return 'promo';
    default:
      return 'transactional';
  }
}

/** @deprecated Prefer createWorkerMessagingContext (worker) with conversation_sessions. */
export function createClosedSessionContext(
  partial: Omit<MessagingContext, 'getSession'> & {
    getSession?: MessagingContext['getSession'];
  }
): MessagingContext {
  return {
    ...partial,
    getSession:
      partial.getSession ??
      (async () => ({
        organizationId: '',
        clientId: '',
        channel: 'whatsapp',
        sessionOpen: false,
      })),
  };
}
