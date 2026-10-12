import { describe, expect, it } from 'vitest';
import { normalizeStripeEvent } from './stripe-events';

const ORG = '3f2a9c1e-77aa-4b1b-9c1d-000000000000';

describe('normalizeStripeEvent', () => {
  it('reads invoice.paid with subscription metadata under parent', () => {
    const event = normalizeStripeEvent({
      id: 'evt_1',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          number: 'LOY-0001',
          customer: 'cus_1',
          amount_paid: 4573,
          currency: 'eur',
          hosted_invoice_url: 'https://invoice.stripe.com/i/1',
          parent: {
            subscription_details: {
              subscription: 'sub_1',
              metadata: { organizationId: ORG, planCode: 'growth' },
            },
          },
          lines: { data: [{ period: { start: 1_760_000_000, end: 1_762_592_000 } }] },
        },
      },
    });

    expect(event).toMatchObject({
      eventId: 'evt_1',
      type: 'invoice.paid',
      organizationId: ORG,
      planCode: 'growth',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      invoiceId: 'in_1',
      invoiceNumber: 'LOY-0001',
      amountCents: 4573,
      currency: 'EUR',
      periodStart: new Date(1_760_000_000_000).toISOString(),
      periodEnd: new Date(1_762_592_000_000).toISOString(),
    });
  });

  it('falls back to legacy invoice.subscription fields', () => {
    const event = normalizeStripeEvent({
      id: 'evt_2',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_2',
          customer: { id: 'cus_2' },
          subscription: 'sub_2',
          subscription_details: { metadata: { organizationId: ORG, planCode: 'pro' } },
          amount_due: 12196,
          currency: 'eur',
        },
      },
    });

    expect(event).toMatchObject({
      type: 'invoice.payment_failed',
      organizationId: ORG,
      planCode: 'pro',
      customerId: 'cus_2',
      subscriptionId: 'sub_2',
      amountCents: 12196,
    });
  });

  it('maps subscription deletion and scheduled cancellation', () => {
    const deleted = normalizeStripeEvent({
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_3',
          customer: 'cus_3',
          metadata: { organizationId: ORG, planCode: 'growth' },
          cancel_at: 1_762_592_000,
          items: { data: [{ current_period_end: 1_762_592_000 }] },
        },
      },
    });

    expect(deleted).toMatchObject({
      type: 'subscription.deleted',
      organizationId: ORG,
      subscriptionId: 'sub_3',
      cancelAt: new Date(1_762_592_000_000).toISOString(),
      periodEnd: new Date(1_762_592_000_000).toISOString(),
    });
  });

  it('ignores unrelated events', () => {
    expect(
      normalizeStripeEvent({ id: 'evt_4', type: 'charge.succeeded', data: { object: {} } })
    ).toBeNull();
  });
});
