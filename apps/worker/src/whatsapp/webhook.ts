import {
  applyMetaWebhookStatus,
  applyMetaWebhookInboundMessages,
  parseMetaWebhookInboundMessages,
  parseMetaWebhookStatuses,
  validateMetaWebhookPayload,
} from '@loyala/domain-crm';
import { recordDomainEvent } from '@loyala/events';
import { emitDomainEventBridge } from '../domain-events/bridge.js';
import { logStructured } from '@loyala/integrations';
import { getWorkerAdminClient } from '../supabase.js';
import {
  buildWebhookDedupeKey,
  clearWebhookReplayCache,
  isReplayedWebhook,
  markWebhookProcessed,
} from './webhook-replay.js';
import {
  getWhatsAppAppSecret,
  verifyMetaWebhookSignature,
} from './webhook-security.js';

export interface WebhookVerifyResult {
  status: number;
  body: string;
}

export interface WebhookEventStats {
  processed: number;
  updated: number;
  skipped: number;
  notFound: number;
  duplicate: number;
  replayBlocked: number;
  errors: number;
  inboundProcessed: number;
  inboundSessionsUpdated: number;
  inboundSkipped: number;
}

export interface WebhookPostResult {
  status: number;
  data: WebhookEventStats & { ok: boolean; reason?: string };
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

function parseSignatureHeader(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function emptyStats(): WebhookEventStats {
  return {
    processed: 0,
    updated: 0,
    skipped: 0,
    notFound: 0,
    duplicate: 0,
    replayBlocked: 0,
    errors: 0,
    inboundProcessed: 0,
    inboundSessionsUpdated: 0,
    inboundSkipped: 0,
  };
}

function isSignatureRequired(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return Boolean(getWhatsAppAppSecret());
}

/** Production-grade POST handler — signature, replay guard, idempotent DB updates. */
export async function handleWhatsAppWebhookPost(
  rawBody: Buffer,
  headers: { 'x-hub-signature-256'?: string | string[] }
): Promise<WebhookPostResult> {
  const appSecret = getWhatsAppAppSecret();
  const signature = parseSignatureHeader(headers['x-hub-signature-256']);

  if (isSignatureRequired()) {
    if (!appSecret) {
      logStructured({
        level: 'error',
        service: 'worker',
        message: 'WhatsApp webhook rejected — WHATSAPP_APP_SECRET missing',
      });
      return { status: 503, data: { ...emptyStats(), ok: false, reason: 'app_secret_missing' } };
    }
    if (!verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
      logStructured({
        level: 'warn',
        service: 'worker',
        message: 'WhatsApp webhook rejected — invalid signature',
        context: { hasSignature: Boolean(signature), bodyBytes: rawBody.length },
      });
      return { status: 401, data: { ...emptyStats(), ok: false, reason: 'invalid_signature' } };
    }
  } else if (appSecret && signature) {
    if (!verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
      return { status: 401, data: { ...emptyStats(), ok: false, reason: 'invalid_signature' } };
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    logStructured({
      level: 'warn',
      service: 'worker',
      message: 'WhatsApp webhook rejected — invalid JSON',
    });
    return { status: 400, data: { ...emptyStats(), ok: false, reason: 'invalid_json' } };
  }

  const validation = validateMetaWebhookPayload(payload);
  if (!validation.valid) {
    logStructured({
      level: 'info',
      service: 'worker',
      message: 'WhatsApp webhook ignored — payload validation failed',
      context: { reason: validation.reason },
    });
    return {
      status: 200,
      data: { ...emptyStats(), ok: true, reason: validation.reason },
    };
  }

  const statuses = parseMetaWebhookStatuses(payload);
  const inboundMessages = parseMetaWebhookInboundMessages(payload);

  if (statuses.length === 0 && inboundMessages.length === 0) {
    return { status: 200, data: { ...emptyStats(), ok: true, reason: 'no_events' } };
  }

  const admin = getWorkerAdminClient();
  const stats = emptyStats();

  if (inboundMessages.length > 0) {
    try {
      const inboundResult = await applyMetaWebhookInboundMessages(admin, inboundMessages);
      stats.inboundProcessed = inboundResult.processed;
      stats.inboundSessionsUpdated = inboundResult.sessionsUpdated;
      stats.inboundSkipped = inboundResult.skipped;

      for (const match of inboundResult.matched) {
        const recorded = await recordDomainEvent(admin, {
          organizationId: match.organizationId,
          eventType: 'message.received',
          aggregateType: 'client',
          aggregateId: match.clientId,
          actorId: null,
          payload: { wamid: match.wamid, channel: 'whatsapp' },
          metadata: { source: 'whatsapp_webhook' },
        });
        if (recorded.ok) {
          await emitDomainEventBridge({
            eventType: 'message.received',
            organizationId: match.organizationId,
            aggregateId: match.clientId,
            eventId: recorded.eventId,
          });
        }
      }
    } catch (error) {
      stats.errors += 1;
      logStructured({
        level: 'error',
        service: 'worker',
        message: 'WhatsApp webhook inbound session update failed',
        context: {
          error: error instanceof Error ? error.message : String(error),
          inboundCount: inboundMessages.length,
        },
      });
    }
  }

  stats.processed = statuses.length;

  for (const status of statuses) {
    const dedupeKey = buildWebhookDedupeKey(status.wamid, status.status, status.timestamp);
    if (isReplayedWebhook(dedupeKey)) {
      stats.replayBlocked += 1;
      continue;
    }

    try {
      const result = await applyMetaWebhookStatus(admin, status);
      if (result === 'updated') {
        stats.updated += 1;
        markWebhookProcessed(dedupeKey);
      } else if (result === 'skipped') {
        stats.skipped += 1;
        markWebhookProcessed(dedupeKey);
      } else if (result === 'duplicate') {
        stats.duplicate += 1;
        markWebhookProcessed(dedupeKey);
      } else if (result === 'not_found') {
        stats.notFound += 1;
      }
    } catch (error) {
      stats.errors += 1;
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
    context: stats,
  });

  // Always 200 on valid signed payloads so Meta does not retry storms on benign duplicates.
  return { status: 200, data: { ...stats, ok: true } };
}

/** @deprecated Use handleWhatsAppWebhookPost with raw body + signature */
export async function handleWhatsAppWebhookEvent(
  payload: unknown
): Promise<{ status: number; data: WebhookEventStats }> {
  const rawBody = Buffer.from(JSON.stringify(payload ?? {}));
  const result = await handleWhatsAppWebhookPost(rawBody, {});
  return { status: result.status, data: result.data };
}

export { clearWebhookReplayCache };
