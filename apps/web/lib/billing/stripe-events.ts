export type StripeBillingEventType =
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'subscription.updated'
  | 'subscription.deleted';

/** Payload of the `apply_stripe_billing_event` RPC (migration 039). */
export interface StripeBillingEvent {
  eventId: string;
  type: StripeBillingEventType;
  organizationId: string | null;
  planCode: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  amountCents: number | null;
  currency: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAt: string | null;
}

const EVENT_TYPES: Record<string, StripeBillingEventType> = {
  'invoice.paid': 'invoice.paid',
  'invoice.payment_failed': 'invoice.payment_failed',
  'customer.subscription.updated': 'subscription.updated',
  'customer.subscription.deleted': 'subscription.deleted',
};

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj | null {
  return value && typeof value === 'object' ? (value as Obj) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Expandable Stripe fields are either an id or an object with `id`. */
function idOf(value: unknown): string | null {
  return str(value) ?? str(obj(value)?.id);
}

function isoFromUnix(value: unknown): string | null {
  return typeof value === 'number' && value > 0 ? new Date(value * 1000).toISOString() : null;
}

function metadataField(meta: unknown, key: string): string | null {
  return str(obj(meta)?.[key]);
}

/** Subscription metadata lives under `parent.subscription_details` on recent API versions. */
function invoiceSubscriptionDetails(invoice: Obj): { subscriptionId: string | null; metadata: unknown } {
  const details = obj(obj(invoice.parent)?.subscription_details);
  const legacy = obj(invoice.subscription_details);
  return {
    subscriptionId: idOf(details?.subscription) ?? idOf(invoice.subscription),
    metadata: details?.metadata ?? legacy?.metadata ?? null,
  };
}

function invoicePeriod(invoice: Obj): { start: string | null; end: string | null } {
  const lines = obj(invoice.lines)?.data;
  const period = Array.isArray(lines) ? obj(obj(lines[0])?.period) : null;
  return {
    start: isoFromUnix(period?.start) ?? isoFromUnix(invoice.period_start),
    end: isoFromUnix(period?.end) ?? isoFromUnix(invoice.period_end),
  };
}

function subscriptionPeriodEnd(subscription: Obj): string | null {
  const items = obj(subscription.items)?.data;
  const first = Array.isArray(items) ? obj(items[0]) : null;
  return isoFromUnix(first?.current_period_end) ?? isoFromUnix(subscription.current_period_end);
}

/**
 * Reduces a verified Stripe event to what Loyala stores. Returns null for events we don't handle.
 * `organizationId` / `planCode` may be null on invoices; the webhook then reads them from the subscription.
 */
export function normalizeStripeEvent(event: { id: string; type: string; data: { object: unknown } }): StripeBillingEvent | null {
  const type = EVENT_TYPES[event.type];
  const object = obj(event.data.object);
  if (!type || !object) return null;

  const base: StripeBillingEvent = {
    eventId: event.id,
    type,
    organizationId: null,
    planCode: null,
    customerId: idOf(object.customer),
    subscriptionId: null,
    invoiceId: null,
    invoiceNumber: null,
    invoiceUrl: null,
    amountCents: null,
    currency: null,
    periodStart: null,
    periodEnd: null,
    cancelAt: null,
  };

  if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
    const { subscriptionId, metadata } = invoiceSubscriptionDetails(object);
    const period = invoicePeriod(object);
    return {
      ...base,
      organizationId: metadataField(metadata, 'organizationId'),
      planCode: metadataField(metadata, 'planCode'),
      subscriptionId,
      invoiceId: str(object.id),
      invoiceNumber: str(object.number),
      invoiceUrl: str(object.hosted_invoice_url),
      amountCents:
        typeof object.amount_paid === 'number'
          ? object.amount_paid
          : typeof object.amount_due === 'number'
            ? object.amount_due
            : null,
      currency: str(object.currency)?.toUpperCase() ?? null,
      periodStart: period.start,
      periodEnd: period.end,
    };
  }

  return {
    ...base,
    organizationId: metadataField(object.metadata, 'organizationId'),
    planCode: metadataField(object.metadata, 'planCode'),
    subscriptionId: str(object.id),
    periodEnd: subscriptionPeriodEnd(object),
    cancelAt: isoFromUnix(object.cancel_at),
  };
}
