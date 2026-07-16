/**
 * Webhook verification for OpenPay Congo.
 * Public docs do not define a signature scheme — optional shared secret header only.
 */
export interface WebhookVerifyResult {
  ok: boolean;
  reason?: string;
}

export function verifyOpenPayWebhook(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string | undefined
): WebhookVerifyResult {
  if (!secret) {
    // Soft mode: accept but mark unverified (caller should log)
    return { ok: true, reason: 'OPENPAY_WEBHOOK_SECRET unset — accepting without signature' };
  }

  const header =
    headerValue(headers['x-openpay-signature']) ??
    headerValue(headers['x-openpay-webhook-signature']) ??
    headerValue(headers['x-signature']);

  if (!header) {
    return { ok: false, reason: 'missing webhook signature header' };
  }

  // Timing-safe-ish compare for shared secret (not HMAC until Congo docs provide algorithm)
  if (header.trim() !== secret.trim()) {
    return { ok: false, reason: 'invalid webhook signature' };
  }

  // Ensure body is parseable JSON when secret is set
  try {
    JSON.parse(rawBody || '{}');
  } catch {
    return { ok: false, reason: 'invalid JSON body' };
  }

  return { ok: true };
}

function headerValue(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
