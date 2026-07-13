import { applyMetaWebhookStatus, parseMetaWebhookStatuses } from '@loyala/domain-crm';
import { logStructured } from '@loyala/integrations';
import { getWorkerAdminClient } from '../supabase.js';

export interface WebhookVerifyResult {
  status: number;
  body: string;
}

export interface WebhookEventResult {
  status: number;
  data: {
    processed: number;
    updated: number;
    skipped: number;
    notFound: number;
  };
}

export function getWebhookVerifyToken(): string | undefined {
  return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || undefined;
}

export function handleWhatsAppWebhookVerify(
  params: URLSearchParams
): WebhookVerifyResult {
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  const expected = getWebhookVerifyToken();

  if (mode === 'subscribe' && token && challenge && expected && token === expected) {
    return { status: 200, body: challenge };
  }

  return { status: 403, body: 'Forbidden' };
}

export async function handleWhatsAppWebhookEvent(
  payload: unknown
): Promise<WebhookEventResult> {
  const statuses = parseMetaWebhookStatuses(payload);
  if (statuses.length === 0) {
    return { status: 200, data: { processed: 0, updated: 0, skipped: 0, notFound: 0 } };
  }

  const admin = getWorkerAdminClient();
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const status of statuses) {
    try {
      const result = await applyMetaWebhookStatus(admin, status);
      if (result === 'updated') updated += 1;
      if (result === 'skipped') skipped += 1;
      if (result === 'not_found') notFound += 1;
    } catch (error) {
      logStructured({
        level: 'error',
        service: 'worker',
        message: 'WhatsApp webhook status update failed',
        context: {
          wamid: status.wamid,
          status: status.status,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  logStructured({
    level: 'info',
    service: 'worker',
    message: 'WhatsApp webhook processed',
    context: { processed: statuses.length, updated, skipped, notFound },
  });

  return {
    status: 200,
    data: {
      processed: statuses.length,
      updated,
      skipped,
      notFound,
    },
  };
}
