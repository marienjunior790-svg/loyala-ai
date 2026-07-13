import {
  insertWhatsAppMessage,
  listPendingCampaignSendsForCampaign,
  markCampaignSendFailed,
  markCampaignSendSent,
  recordOutboundConversationSession,
  type CampaignSend,
} from '@loyala/domain-crm';
import {
  deliverOutboundMessage,
  type MessageIntent,
} from '@loyala/messaging';
import { loadTemplateCatalog } from '../messaging/load-catalog.js';
import {
  getMetaWhatsAppConfigFromEnv,
  isWhatsAppApiEnabled,
  logStructured,
  normalizePhoneForWhatsApp,
} from '@loyala/integrations';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createWorkerMessagingContext } from '../messaging/context.js';

export interface WhatsAppAutoSendConfig {
  enabled: boolean;
  testClientId?: string;
  testPhone?: string;
  templateName?: string;
  templateLanguage: string;
}

export interface AutoSendCampaignResult {
  attempted: boolean;
  sent: boolean;
  skippedReason?: string;
  campaignSendId?: string;
  wamid?: string | null;
  error?: string;
  deliveryMode?: string;
  deepLinkUrl?: string;
}

export function getWhatsAppAutoSendConfig(
  source: NodeJS.ProcessEnv = process.env
): WhatsAppAutoSendConfig {
  return {
    enabled: isWhatsAppApiEnabled(source),
    testClientId: source.WHATSAPP_TEST_CLIENT_ID?.trim() || undefined,
    testPhone: source.WHATSAPP_TEST_PHONE?.trim() || undefined,
    templateName: source.WHATSAPP_CAMPAIGN_TEMPLATE_NAME?.trim() || undefined,
    templateLanguage: source.WHATSAPP_CAMPAIGN_TEMPLATE_LANGUAGE?.trim() || 'fr',
  };
}

export function isEligibleForAutoSend(
  send: CampaignSend,
  config: Pick<WhatsAppAutoSendConfig, 'testClientId' | 'testPhone'>
): boolean {
  if (config.testClientId && send.client_id === config.testClientId) {
    return true;
  }
  if (config.testPhone) {
    const sendPhone = send.clients?.phone ?? '';
    return (
      Boolean(sendPhone) &&
      normalizePhoneForWhatsApp(sendPhone) === normalizePhoneForWhatsApp(config.testPhone)
    );
  }
  return false;
}

function resolveSendPhone(send: CampaignSend): string {
  const phone = send.clients?.phone?.trim();
  if (!phone) {
    throw new Error(`Campaign send ${send.id} has no client phone`);
  }
  return phone;
}

export async function autoSendCampaignForTestClient(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    campaignId: string;
    intent?: MessageIntent;
    restaurantName?: string;
  },
  config: WhatsAppAutoSendConfig = getWhatsAppAutoSendConfig()
): Promise<AutoSendCampaignResult> {
  if (!config.enabled) {
    return { attempted: false, sent: false, skippedReason: 'whatsapp_api_disabled' };
  }

  if (!config.testClientId && !config.testPhone) {
    return {
      attempted: false,
      sent: false,
      skippedReason: 'no_test_client_gate',
    };
  }

  const pending = await listPendingCampaignSendsForCampaign(
    supabase,
    params.organizationId,
    params.campaignId
  );

  const target = pending.find((send) => isEligibleForAutoSend(send, config));
  if (!target) {
    return {
      attempted: false,
      sent: false,
      skippedReason: 'test_client_not_in_campaign',
    };
  }

  const phone = resolveSendPhone(target);
  const clientName = target.clients?.full_name ?? 'Client';
  const messageBody = target.message_body;
  const intent = params.intent ?? 'transactional';

  const templateCatalog = await loadTemplateCatalog(supabase, {
    organizationId: params.organizationId,
    templateName: config.templateName,
    templateLanguage: config.templateLanguage,
  });

  const delivery = await deliverOutboundMessage(
    {
      organizationId: params.organizationId,
      clientId: target.client_id ?? '',
      campaignSendId: target.id,
      channel: 'whatsapp',
      body: messageBody,
      phone,
      optIn: true,
      intent,
      metadata: {
        clientName,
        restaurantName: params.restaurantName,
      },
    },
    createWorkerMessagingContext(supabase, {
      apiEnabled: config.enabled && Boolean(getMetaWhatsAppConfigFromEnv()),
      templateCatalog,
    })
  );

  if (delivery.mode === 'deep_link') {
    return {
      attempted: false,
      sent: false,
      skippedReason: delivery.skipReason ?? 'fallback_deep_link',
      campaignSendId: target.id,
      deliveryMode: delivery.mode,
      deepLinkUrl: delivery.deepLinkUrl,
    };
  }

  if (delivery.mode === 'skipped') {
    return {
      attempted: false,
      sent: false,
      skippedReason: delivery.skipReason ?? 'skipped',
      campaignSendId: target.id,
      deliveryMode: delivery.mode,
    };
  }

  if (delivery.status === 'sent' && delivery.externalId) {
    await insertWhatsAppMessage(supabase, {
      organizationId: params.organizationId,
      clientId: target.client_id,
      campaignSendId: target.id,
      wamid: delivery.externalId,
      phone: normalizePhoneForWhatsApp(phone),
      templateName: delivery.templateName ?? null,
      messageBody,
      status: 'sent',
      sentAt: new Date().toISOString(),
      rawPayload: {
        deliveryMode: delivery.mode,
        templateVariables: delivery.templateVariables,
        resolvedPayload: delivery.resolvedPayload,
      },
    });

    await markCampaignSendSent(supabase, params.organizationId, target.id);

    await recordOutboundConversationSession(supabase, {
      organizationId: params.organizationId,
      clientId: target.client_id ?? '',
      phone: normalizePhoneForWhatsApp(phone),
      sentAt: new Date().toISOString(),
    }).catch((sessionError) => {
      logStructured({
        level: 'warn',
        service: 'worker',
        message: 'conversation_sessions outbound touch failed',
        context: {
          campaignSendId: target.id,
          error: sessionError instanceof Error ? sessionError.message : String(sessionError),
        },
      });
    });

    logStructured({
      level: 'info',
      service: 'worker',
      message: 'WhatsApp campaign auto-send succeeded',
      context: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        campaignSendId: target.id,
        wamid: delivery.externalId,
        deliveryMode: delivery.mode,
        templateName: delivery.templateName,
      },
    });

    return {
      attempted: true,
      sent: true,
      campaignSendId: target.id,
      wamid: delivery.externalId,
      deliveryMode: delivery.mode,
    };
  }

  const errorMessage = delivery.errorMessage ?? 'WhatsApp send failed';

  await insertWhatsAppMessage(supabase, {
    organizationId: params.organizationId,
    clientId: target.client_id,
    campaignSendId: target.id,
    phone: normalizePhoneForWhatsApp(phone),
    templateName: delivery.templateName ?? null,
    messageBody,
    status: 'failed',
    errorMessage,
    rawPayload: {
      deliveryMode: delivery.mode,
      templateVariables: delivery.templateVariables,
    },
  }).catch((insertError) => {
    logStructured({
      level: 'warn',
      service: 'worker',
      message: 'Failed to log whatsapp_messages row after send error',
      context: {
        campaignSendId: target.id,
        error: insertError instanceof Error ? insertError.message : String(insertError),
      },
    });
  });

  await markCampaignSendFailed(supabase, params.organizationId, target.id).catch(() => {});

  logStructured({
    level: 'error',
    service: 'worker',
    message: 'WhatsApp campaign auto-send failed',
    context: {
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      campaignSendId: target.id,
      error: errorMessage,
      deliveryMode: delivery.mode,
    },
  });

  return {
    attempted: true,
    sent: false,
    campaignSendId: target.id,
    error: errorMessage,
    deliveryMode: delivery.mode,
  };
}
