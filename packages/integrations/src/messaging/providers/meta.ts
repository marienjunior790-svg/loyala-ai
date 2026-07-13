import { normalizePhoneForWhatsApp } from '../normalize-phone';
import type {
  MessageStatusResult,
  MetaWhatsAppConfig,
  SendMessageInput,
  SendMessageResult,
} from '../types';

export class MetaWhatsAppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'MetaWhatsAppError';
  }
}

function graphUrl(config: MetaWhatsAppConfig, path: string): string {
  const version = config.apiVersion.replace(/^v/, 'v');
  return `https://graph.facebook.com/${version}/${path}`;
}

function buildTemplatePayload(input: Extract<SendMessageInput, { type: 'template' }>, to: string) {
  const components =
    input.templateVariables && input.templateVariables.length > 0
      ? [
          {
            type: 'body',
            parameters: input.templateVariables.map((text) => ({
              type: 'text',
              text,
            })),
          },
        ]
      : undefined;

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.templateLanguage ?? 'fr' },
      ...(components ? { components } : {}),
    },
  };
}

function mapGraphStatus(raw: unknown): MessageStatusResult['status'] {
  const status = String((raw as { status?: string })?.status ?? 'sent').toLowerCase();
  if (status === 'delivered') return 'delivered';
  if (status === 'read') return 'read';
  if (status === 'failed') return 'failed';
  return 'sent';
}

export async function sendViaMeta(
  input: SendMessageInput,
  config: MetaWhatsAppConfig
): Promise<SendMessageResult> {
  const to = normalizePhoneForWhatsApp(input.phone);
  const payload =
    input.type === 'text'
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: input.body },
        }
      : buildTemplatePayload(input, to);

  const res = await fetch(graphUrl(config, `${config.phoneNumberId}/messages`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (raw as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new MetaWhatsAppError(`Meta WhatsApp send failed: ${err}`, res.status, raw);
  }

  const wamid = (raw as { messages?: { id?: string }[] })?.messages?.[0]?.id ?? null;

  return {
    provider: 'meta',
    wamid,
    status: wamid ? 'sent' : 'failed',
    phone: to,
    templateName: input.type === 'template' ? input.templateName : undefined,
    messageBody: input.type === 'text' ? input.body : input.body,
    raw,
    errorMessage: wamid ? undefined : 'Meta response missing message id',
  };
}

export async function checkMessageStatusViaMeta(
  wamid: string,
  config: MetaWhatsAppConfig
): Promise<MessageStatusResult> {
  const res = await fetch(graphUrl(config, wamid), {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (raw as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new MetaWhatsAppError(`Meta WhatsApp status failed: ${err}`, res.status, raw);
  }

  return {
    wamid,
    status: mapGraphStatus(raw),
    raw,
  };
}
