import {
  OpenPayError,
  type CreateOpenPayPaymentInput,
  type OpenPayClientConfig,
  type OpenPayPaymentResult,
  type OpenPayStatusResult,
} from './types.js';

const DEFAULT_BASE = 'https://api.openpay-cg.com/v1';

/**
 * OpenPay Congo HTTP client (server-side only).
 * Public docs: POST /transaction/payment with XO-API-KEY.
 * Status / refund endpoints are not public — methods are typed stubs.
 */
export class OpenPayCgClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor(config: OpenPayClientConfig) {
    this.apiKey = config.apiKey?.trim() ?? '';
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    this.enabled = config.enabled !== false && Boolean(this.apiKey);
  }

  get isConfigured(): boolean {
    return this.enabled && this.apiKey.length > 0;
  }

  async createPayment(input: CreateOpenPayPaymentInput): Promise<OpenPayPaymentResult> {
    if (!this.isConfigured) {
      return { ok: false, raw: null, error: 'OPENPAY_API_KEY not configured' };
    }

    const body = {
      amount: String(input.amount),
      payment_phone_number: input.paymentPhoneNumber,
      provider: input.provider,
      ...(input.customerExternalId
        ? { customer_external_id: input.customerExternalId }
        : {}),
      ...(input.customer ? { customer: input.customer } : {}),
      metadata: input.metadata ?? {},
    };

    try {
      const res = await fetch(`${this.baseUrl}/transaction/payment`, {
        method: 'POST',
        headers: {
          'XO-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      const text = await res.text();
      let raw: unknown = text;
      try {
        raw = text ? JSON.parse(text) : null;
      } catch {
        /* keep text */
      }

      if (!res.ok) {
        return {
          ok: false,
          raw,
          error: `OpenPay HTTP ${res.status}`,
        };
      }

      const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const providerTxId = pickTxId(obj);

      return {
        ok: true,
        providerTxId,
        status: typeof obj.status === 'string' ? obj.status : 'pending',
        raw,
      };
    } catch (error) {
      return {
        ok: false,
        raw: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Status polling — NOT documented on openpay.cg public docs.
   * Returns unknown until private specs are wired; never invents success.
   */
  async getPaymentStatus(providerTxId: string): Promise<OpenPayStatusResult> {
    if (!this.isConfigured) {
      return { ok: false, status: 'unknown', raw: null, error: 'OPENPAY_API_KEY not configured' };
    }
    if (!providerTxId) {
      return { ok: false, status: 'unknown', raw: null, error: 'missing providerTxId' };
    }

    // Contract: do not call undocumented endpoints in production.
    if (process.env.OPENPAY_STATUS_PATH) {
      const path = process.env.OPENPAY_STATUS_PATH.replace(':id', encodeURIComponent(providerTxId));
      try {
        const res = await fetch(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
          headers: {
            'XO-API-KEY': this.apiKey,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        });
        const raw = await res.json().catch(() => null);
        const status = mapStatus(
          raw && typeof raw === 'object'
            ? String((raw as Record<string, unknown>).status ?? '')
            : ''
        );
        return { ok: res.ok, status, providerTxId, raw };
      } catch (error) {
        return {
          ok: false,
          status: 'unknown',
          providerTxId,
          raw: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      ok: false,
      status: 'unknown',
      providerTxId,
      raw: null,
      error:
        'OpenPay Congo status endpoint not documented publicly — set OPENPAY_STATUS_PATH when available',
    };
  }

  /**
   * Refunds — NOT documented. Typed stub that refuses in production.
   */
  async refund(_providerTxId: string, _amount?: number): Promise<OpenPayPaymentResult> {
    return {
      ok: false,
      raw: null,
      error: 'OpenPay Congo refunds not documented — refused by contract stub',
    };
  }
}

function pickTxId(obj: Record<string, unknown>): string | undefined {
  for (const key of ['id', 'transaction_id', 'transactionId', 'reference', 'payment_id']) {
    const v = obj[key];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number') return String(v);
  }
  const data = obj.data;
  if (data && typeof data === 'object') {
    return pickTxId(data as Record<string, unknown>);
  }
  return undefined;
}

function mapStatus(raw: string): OpenPayStatusResult['status'] {
  const s = raw.toLowerCase();
  if (['success', 'succeeded', 'paid', 'completed', 'ok'].includes(s)) return 'succeeded';
  if (['failed', 'error', 'declined', 'cancelled', 'canceled'].includes(s)) return 'failed';
  if (['pending', 'initiated', 'created'].includes(s)) return 'pending';
  if (['processing', 'in_progress'].includes(s)) return 'processing';
  return 'unknown';
}

export function createOpenPayClientFromEnv(
  env: Record<string, string | undefined> = process.env
): OpenPayCgClient {
  return new OpenPayCgClient({
    apiKey: env.OPENPAY_API_KEY ?? '',
    baseUrl: env.OPENPAY_API_BASE ?? DEFAULT_BASE,
    enabled: env.BILLING_ENABLED !== 'false',
  });
}

export { OpenPayError };
