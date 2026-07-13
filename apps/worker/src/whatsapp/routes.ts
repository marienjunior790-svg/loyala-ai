import { insertWhatsAppMessage } from '@loyala/domain-crm';
import {
  getMetaWhatsAppConfigFromEnv,
  isWhatsAppApiEnabled,
  logStructured,
  normalizePhoneForWhatsApp,
  sendWhatsAppMessage,
  type SendMessageResult,
} from '@loyala/integrations';
import { getWorkerAdminClient } from '../supabase.js';

export function whatsAppHealth() {
  const enabled = isWhatsAppApiEnabled();
  const configured = Boolean(getMetaWhatsAppConfigFromEnv());
  const webhookConfigured = Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim());
  return {
    apiEnabled: enabled,
    configured,
    webhookConfigured,
    ready: enabled && configured,
  };
}

async function persistProbeSend(
  body: Record<string, unknown>,
  result: SendMessageResult,
  templateName?: string
): Promise<void> {
  const organizationId = String(body.organizationId ?? '').trim();
  if (!organizationId || !result.wamid) return;

  const admin = getWorkerAdminClient();
  await insertWhatsAppMessage(admin, {
    organizationId,
    clientId: String(body.clientId ?? '').trim() || null,
    campaignSendId: String(body.campaignSendId ?? '').trim() || null,
    wamid: result.wamid,
    phone: result.phone,
    templateName: templateName ?? null,
    messageBody: result.messageBody ?? String(body.body ?? '') || null,
    status: 'sent',
    sentAt: new Date().toISOString(),
    rawPayload: { source: 'send-test', ...((result.raw as object) ?? {}) },
  });
}

export async function handleWhatsAppSend(
  body: Record<string, unknown>
): Promise<{ status: number; data: unknown }> {
  if (!isWhatsAppApiEnabled()) {
    return {
      status: 503,
      data: {
        error: 'WhatsApp API disabled — set WHATSAPP_API_ENABLED=true on the worker',
        fallback: 'wa.me',
      },
    };
  }

  const to = String(body.to ?? '').trim();
  if (!to) {
    return { status: 400, data: { error: 'to (phone) is required' } };
  }

  const messageType = body.type === 'text' ? 'text' : 'template';
  const templateName = String(body.templateName ?? 'hello_world').trim();
  const templateLanguage = String(body.templateLanguage ?? 'fr').trim();
  const templateVariables = Array.isArray(body.templateVariables)
    ? body.templateVariables.map((v) => String(v))
    : undefined;
  const textBody = String(body.body ?? '').trim();

  try {
    let result: SendMessageResult;

    if (messageType === 'text') {
      if (!textBody) {
        return { status: 400, data: { error: 'body is required for type=text' } };
      }
      result = await sendWhatsAppMessage({ type: 'text', phone: to, body: textBody });
    } else {
      result = await sendWhatsAppMessage({
        type: 'template',
        phone: to,
        templateName,
        templateLanguage,
        templateVariables,
        body: textBody || undefined,
      });
    }

    let persisted = false;
    if (body.organizationId) {
      try {
        await persistProbeSend(body, result, messageType === 'template' ? templateName : undefined);
        persisted = Boolean(result.wamid);
      } catch (error) {
        logStructured({
          level: 'warn',
          service: 'worker',
          message: 'send-test whatsapp_messages persist failed',
          context: {
            organizationId: body.organizationId,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return {
      status: 200,
      data: {
        ...result,
        persisted,
        phone: result.phone || normalizePhoneForWhatsApp(to),
      },
    };
  } catch (error) {
    const organizationId = String(body.organizationId ?? '').trim();
    if (organizationId) {
      try {
        const admin = getWorkerAdminClient();
        await insertWhatsAppMessage(admin, {
          organizationId,
          clientId: String(body.clientId ?? '').trim() || null,
          campaignSendId: String(body.campaignSendId ?? '').trim() || null,
          phone: normalizePhoneForWhatsApp(to),
          templateName: messageType === 'template' ? templateName : null,
          messageBody: textBody || null,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'WhatsApp send failed',
          rawPayload: { source: 'send-test' },
        });
      } catch {
        // Best-effort failure log for E2E probes.
      }
    }

    return {
      status: 502,
      data: {
        error: error instanceof Error ? error.message : 'WhatsApp send failed',
      },
    };
  }
}
