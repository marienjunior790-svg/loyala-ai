import { fetchConversationSession, isSessionOpen } from '@loyala/domain-crm';
import type { MessagingChannel, MessagingContext } from '@loyala/messaging';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createWorkerMessagingContext(
  supabase: SupabaseClient,
  partial: Omit<MessagingContext, 'getSession'>
): MessagingContext {
  return {
    ...partial,
    getSession: async (organizationId, clientId, channel) => {
      const row = await fetchConversationSession(
        supabase,
        organizationId,
        clientId,
        channel as MessagingChannel
      );

      return {
        organizationId,
        clientId,
        channel,
        sessionOpen: isSessionOpen(row?.last_inbound_at),
        lastInboundAt: row?.last_inbound_at ?? undefined,
      };
    },
  };
}
