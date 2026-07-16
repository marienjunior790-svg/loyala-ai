import {
  createOpenPayClientFromEnv,
  verifyOpenPayWebhook,
  logStructured,
} from '@loyala/integrations';
import { syncSubscriptionFromPayment, getPlan, type PlanCode } from '@loyala/domain-billing';
import { recordDomainEvent } from '@loyala/events';
import { getWorkerAdminClient } from '../supabase.js';

export function billingHealth() {
  const client = createOpenPayClientFromEnv();
  return {
    provider: process.env.BILLING_PROVIDER ?? 'openpay_cg',
    enabled: process.env.BILLING_ENABLED === 'true',
    openPayConfigured: client.isConfigured,
    webhookSecretConfigured: Boolean(process.env.OPENPAY_WEBHOOK_SECRET),
    statusPathConfigured: Boolean(process.env.OPENPAY_STATUS_PATH),
  };
}

export async function handleBillingWebhookPost(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
): Promise<{ status: number; data: Record<string, unknown> }> {
  const raw = rawBody.toString('utf8');
  const verify = verifyOpenPayWebhook(headers, raw, process.env.OPENPAY_WEBHOOK_SECRET);

  if (!verify.ok) {
    return { status: 401, data: { ok: false, error: verify.reason } };
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return { status: 400, data: { ok: false, error: 'invalid JSON' } };
  }

  const admin = getWorkerAdminClient();
  const eventId =
    (typeof payload.id === 'string' && payload.id) ||
    (typeof payload.event_id === 'string' && payload.event_id) ||
    null;

  if (eventId) {
    const { data: existing } = await admin
      .from('payment_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (existing) {
      return { status: 200, data: { ok: true, deduped: true } };
    }
  }

  await admin.from('payment_logs').insert({
    level: 'info',
    message: 'OpenPay webhook received',
    payload: { headers: sanitizeHeaders(headers), body: payload, verify },
  });

  // Typed stub: map common success shapes when private docs arrive
  const status = String(payload.status ?? payload.type ?? '').toLowerCase();
  const isSuccess = ['succeeded', 'success', 'paid', 'charge.succeeded', 'payment.succeeded'].some(
    (s) => status.includes(s)
  );

  if (!isSuccess) {
    await admin.from('payment_events').insert({
      event_type: 'payment.webhook',
      event_id: eventId,
      payload,
    });
    return {
      status: 200,
      data: {
        ok: true,
        handled: 'logged',
        note: 'OpenPay Congo webhook schema not fully documented — payload stored',
      },
    };
  }

  const providerTxId =
    (typeof payload.transaction_id === 'string' && payload.transaction_id) ||
    (typeof payload.id === 'string' && payload.id) ||
    undefined;

  const metadata = (payload.metadata ?? {}) as Record<string, unknown>;
  const organizationId =
    typeof metadata.organizationId === 'string' ? metadata.organizationId : null;
  const paymentId = typeof metadata.paymentId === 'string' ? metadata.paymentId : null;
  const planCode = (typeof metadata.planCode === 'string' ? metadata.planCode : 'growth') as PlanCode;

  if (!organizationId || !paymentId) {
    return {
      status: 200,
      data: { ok: true, handled: 'logged', reason: 'missing organizationId/paymentId in metadata' },
    };
  }

  const sync = await syncSubscriptionFromPayment(admin, {
    organizationId,
    paymentId,
    providerTxId,
    planCode,
    periodDays: getPlan(planCode)?.periodDays ?? 30,
  });

  if (sync.ok) {
    await recordDomainEvent(admin, {
      organizationId,
      eventType: 'payment.succeeded',
      aggregateType: 'payment',
      aggregateId: paymentId,
      payload: { providerTxId, planCode },
      metadata: { source: 'openpay_webhook' },
    });
  }

  return { status: 200, data: { ok: sync.ok, error: sync.error } };
}

export async function pollPendingPayments(): Promise<{ polled: number; succeeded: number }> {
  const admin = getWorkerAdminClient();
  const client = createOpenPayClientFromEnv();
  const { data: pending } = await admin
    .from('payments')
    .select('id, organization_id, provider_tx_id, metadata, status')
    .in('status', ['pending', 'processing'])
    .not('provider_tx_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(20);

  let succeeded = 0;
  for (const row of pending ?? []) {
    const txId = String(row.provider_tx_id);
    const status = await client.getPaymentStatus(txId);
    await admin.from('payment_logs').insert({
      organization_id: row.organization_id,
      payment_id: row.id,
      level: 'info',
      message: 'OpenPay status poll',
      payload: status,
    });

    if (status.status === 'succeeded') {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const planCode = (typeof meta.planCode === 'string' ? meta.planCode : 'growth') as PlanCode;
      const sync = await syncSubscriptionFromPayment(admin, {
        organizationId: String(row.organization_id),
        paymentId: String(row.id),
        providerTxId: txId,
        planCode,
        periodDays: getPlan(planCode)?.periodDays ?? 30,
      });
      if (sync.ok) succeeded += 1;
    } else if (status.status === 'failed') {
      await admin
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }

  return { polled: pending?.length ?? 0, succeeded };
}

export async function runBillingRenewals(): Promise<{ pastDue: number }> {
  const admin = getWorkerAdminClient();
  const { data: due } = await admin
    .from('subscriptions')
    .select('organization_id')
    .eq('status', 'active')
    .lt('current_period_end', new Date().toISOString())
    .limit(50);

  let pastDue = 0;
  for (const row of due ?? []) {
    const { error } = await admin.rpc('mark_subscription_past_due', {
      p_organization_id: row.organization_id,
    });
    if (!error) {
      pastDue += 1;
      logStructured({
        level: 'info',
        service: 'worker',
        message: 'Subscription marked past_due',
        context: { organizationId: row.organization_id },
      });
    }
  }
  return { pastDue };
}

function sanitizeHeaders(headers: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (/auth|key|secret|signature/i.test(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = Array.isArray(v) ? v.join(',') : String(v ?? '');
    }
  }
  return out;
}
