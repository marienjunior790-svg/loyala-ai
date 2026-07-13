import {
  getMetaWhatsAppConfigFromEnv,
  isWhatsAppApiEnabled,
  sendWhatsAppMessage,
  type SendMessageResult,
} from '@loyala/integrations';

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

    return { status: 200, data: result };
  } catch (error) {
    return {
      status: 502,
      data: {
        error: error instanceof Error ? error.message : 'WhatsApp send failed',
      },
    };
  }
}
