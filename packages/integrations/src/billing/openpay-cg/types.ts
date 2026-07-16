export type OpenPayNetwork = 'MTN' | 'AIRTEL';

export interface CreateOpenPayPaymentInput {
  amount: number;
  paymentPhoneNumber: string;
  provider: OpenPayNetwork;
  customerExternalId?: string;
  customer?: { name?: string; phone?: string };
  metadata?: Record<string, unknown>;
}

export interface OpenPayPaymentResult {
  ok: boolean;
  /** Provider transaction id when returned by API */
  providerTxId?: string;
  status?: string;
  raw: unknown;
  error?: string;
}

export interface OpenPayStatusResult {
  ok: boolean;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'unknown';
  providerTxId?: string;
  raw: unknown;
  error?: string;
}

export class OpenPayError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'OpenPayError';
  }
}

export interface OpenPayClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** When false, createPayment throws if key missing */
  enabled?: boolean;
}
