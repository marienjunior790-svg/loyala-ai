import { createHmac, timingSafeEqual } from 'node:crypto';

export function computeMetaWebhookSignature(appSecret: string, rawBody: Buffer): string {
  return createHmac('sha256', appSecret).update(rawBody).digest('hex');
}

export function formatMetaWebhookSignature(digestHex: string): string {
  return `sha256=${digestHex}`;
}

/** Validates Meta `X-Hub-Signature-256` header against the raw POST body. */
export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith('sha256=') || !appSecret.trim()) return false;

  const provided = signatureHeader.slice('sha256='.length).trim();
  const expected = computeMetaWebhookSignature(appSecret, rawBody);

  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function getWhatsAppAppSecret(): string | undefined {
  return process.env.WHATSAPP_APP_SECRET?.trim() || undefined;
}
