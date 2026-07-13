import { sendViaMeta, checkMessageStatusViaMeta } from './providers/meta';
import { sendViaTwilio } from './providers/twilio';
import type {
  MessageStatusResult,
  MetaWhatsAppConfig,
  SendMessageInput,
  SendMessageResult,
  SendTemplateMessageInput,
  SendTextMessageInput,
} from './types';

export * from './types';
export * from './normalize-phone';
export { MetaWhatsAppError, sendViaMeta, checkMessageStatusViaMeta } from './providers/meta';

export function isWhatsAppApiEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  return source.WHATSAPP_API_ENABLED === 'true';
}

export function getMetaWhatsAppConfigFromEnv(
  source: NodeJS.ProcessEnv = process.env
): MetaWhatsAppConfig | null {
  if (!isWhatsAppApiEnabled(source)) return null;

  const accessToken = source.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = source.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) return null;

  return {
    accessToken,
    phoneNumberId,
    businessAccountId: source.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || undefined,
    apiVersion: source.WHATSAPP_API_VERSION?.trim() || 'v21.0',
  };
}

function resolveConfig(input: SendMessageInput): MetaWhatsAppConfig {
  const config = input.config ?? getMetaWhatsAppConfigFromEnv();
  if (!config) {
    throw new Error(
      'WhatsApp API not configured — set WHATSAPP_API_ENABLED=true and Meta credentials on the worker'
    );
  }
  return config;
}

/** Provider-agnostic send — Meta default, Twilio stub. */
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const provider = input.provider ?? 'meta';

  if (provider === 'twilio') {
    return sendViaTwilio(input);
  }

  return sendViaMeta(input, resolveConfig(input));
}

/** Convenience alias for Meta Cloud API sends. */
export async function sendWhatsAppMessage(
  input: (SendTemplateMessageInput | SendTextMessageInput) & {
    config?: MetaWhatsAppConfig;
  }
): Promise<SendMessageResult> {
  return sendMessage({ ...input, provider: 'meta' });
}

export async function checkMessageStatus(
  wamid: string,
  config?: MetaWhatsAppConfig
): Promise<MessageStatusResult> {
  const resolved = config ?? getMetaWhatsAppConfigFromEnv();
  if (!resolved) {
    throw new Error('WhatsApp API not configured — cannot check message status');
  }
  return checkMessageStatusViaMeta(wamid, resolved);
}
