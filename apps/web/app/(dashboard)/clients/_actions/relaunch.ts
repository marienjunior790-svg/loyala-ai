'use server';

import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  buildClientRelanceMessage,
  getClient,
  getOrganization,
  getWhatsAppConnectionPublic,
  recordOutboundConversationSession,
} from '@loyala/domain-crm';
import { getMetaWhatsAppConfigForOrganization } from '@loyala/domain-crm/whatsapp-secure';
import { sendWhatsAppMessage } from '@loyala/integrations';

export type RelaunchActionResult = {
  error?: string;
  success?: string;
  needsConnect?: boolean;
  deepLinkUrl?: string;
};

/**
 * Relance WhatsApp via la connexion Cloud API de l'organisation authentifiée.
 * Never uses another org's WhatsApp as fallback.
 */
export async function relaunchClientWhatsAppAction(
  clientId: string
): Promise<RelaunchActionResult> {
  try {
    const ctx = await requireAuthPermission('clients:write');
    const supabase = await createClient();

    const client = await getClient(supabase, ctx.organizationId, clientId);
    if (!client) return { error: 'Client introuvable' };
    if (client.organization_id !== ctx.organizationId) {
      return { error: 'Accès refusé' };
    }
    if (!client.opt_in_whatsapp) {
      return { error: 'Ce client n’a pas consenti aux messages WhatsApp' };
    }

    const connection = await getWhatsAppConnectionPublic(supabase, ctx.organizationId);
    if (!connection.isReady) {
      return {
        error: 'WhatsApp Business n’est pas encore connecté.',
        needsConnect: true,
      };
    }

    const config = await getMetaWhatsAppConfigForOrganization(supabase, ctx.organizationId);
    if (!config) {
      return {
        error: 'WhatsApp Business n’est pas encore connecté.',
        needsConnect: true,
      };
    }

    const org = await getOrganization(supabase, ctx.organizationId);
    const body = buildClientRelanceMessage({
      clientName: client.full_name,
      restaurantName: org?.name,
    });

    try {
      const result = await sendWhatsAppMessage({
        type: 'text',
        phone: client.phone,
        body,
        config,
      });

      if (result.status === 'failed') {
        return {
          error: result.errorMessage ?? 'Échec envoi WhatsApp',
        };
      }

      await recordOutboundConversationSession(supabase, {
        organizationId: ctx.organizationId,
        clientId: client.id,
        phone: client.phone,
      });

      return { success: 'Relance envoyée via WhatsApp Business de votre restaurant' };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Échec envoi';
      // Outside 24h window Meta rejects free-form text — surface clear error, no cross-org fallback
      return {
        error: message.includes('session') || /131047|470/i.test(message)
          ? 'Fenêtre de conversation fermée (24h). Utilisez un template Meta ou demandez au client d’écrire d’abord.'
          : message,
      };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur relance' };
  }
}
