import {
  insertWhatsAppMessage,
  listPendingCampaignSendsForCampaign,
  markCampaignSendFailed,
  markCampaignSendSent,
  type CampaignSend,
} from '@loyala/domain-crm';
import {
  isWhatsAppApiEnabled,
  logStructured,
  normalizePhoneForWhatsApp,
  sendWhatsAppMessage,
} from '@loyala/integrations';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WhatsAppAutoSendConfig {
  enabled: boolean;
  testClientId?: string;
  testPhone?: string;
  templateName: string;
  templateLanguage: string;
  templateUseNameVariable: boolean;
}

export interface AutoSendCampaignResult {
  attempted: boolean;
  sent: boolean;
  skippedReason?: string;
  campaignSendId?: string;
  wamid?: string | null;
  error?: string;
}

export function getWhatsAppAutoSendConfig(
  source: NodeJS.ProcessEnv = process.env
): WhatsAppAutoSendConfig {
  return {
    enabled: isWhatsAppApiEnabled(source),
    testClientId: source.WHATSAPP_TEST_CLIENT_ID?.trim() || undefined,
    testPhone: source.WHATSAPP_TEST_PHONE?.trim() || undefined,
    templateName: source.WHATSAPP_CAMPAIGN_TEMPLATE_NAME?.trim() || 'hello_world',
    templateLanguage: source.WHATSAPP_CAMPAIGN_TEMPLATE_LANGUAGE?.trim() || 'fr',
    templateUseNameVariable: source.WHATSAPP_CAMPAIGN_TEMPLATE_USE_NAME_VAR === 'true',
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

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function buildTemplateVariables(
  config: WhatsAppAutoSendConfig,
  clientName: string
): string[] | undefined {
  if (!config.templateUseNameVariable) return undefined;
  return [firstName(clientName)];
}

export async function autoSendCampaignForTestClient(
  supabase: SupabaseClient,
  params: { organizationId: string; campaignId: string },
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

  try {
    const templateVariables = buildTemplateVariables(config, clientName);

    const result = await sendWhatsAppMessage({
      type: 'template',
      phone,
      templateName: config.templateName,
      templateLanguage: config.templateLanguage,
      ...(templateVariables ? { templateVariables } : {}),
      body: messageBody,
    });

    if (!result.wamid) {
      throw new Error(result.errorMessage ?? 'Meta response missing wamid');
    }

    await insertWhatsAppMessage(supabase, {
      organizationId: params.organizationId,
      clientId: target.client_id,
      campaignSendId: target.id,
      wamid: result.wamid,
      phone: result.phone,
      templateName: config.templateName,
      messageBody,
      status: 'sent',
      sentAt: new Date().toISOString(),
      rawPayload: result.raw,
    });

    await markCampaignSendSent(supabase, params.organizationId, target.id);

    logStructured({
      level: 'info',
      service: 'worker',
      message: 'WhatsApp campaign auto-send succeeded',
      context: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        campaignSendId: target.id,
        wamid: result.wamid,
      },
    });

    return {
      attempted: true,
      sent: true,
      campaignSendId: target.id,
      wamid: result.wamid,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await insertWhatsAppMessage(supabase, {
      organizationId: params.organizationId,
      clientId: target.client_id,
      campaignSendId: target.id,
      phone: normalizePhoneForWhatsApp(phone),
      templateName: config.templateName,
      messageBody,
      status: 'failed',
      errorMessage,
      rawPayload: error instanceof Error ? { name: error.name, message: error.message } : {},
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
      },
    });

    return {
      attempted: true,
      sent: false,
      campaignSendId: target.id,
      error: errorMessage,
    };
  }
}
