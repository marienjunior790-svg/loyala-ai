import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlan, isPaidPlan, type MobileProvider, type PlanCode } from './plans.js';

const PENDING_TTL_MS = 15 * 60 * 1000;

export interface StartCheckoutParams {
  organizationId: string;
  planCode: PlanCode;
  phone: string;
  providerNetwork: MobileProvider;
  actorId?: string | null;
  orgName?: string;
  /** Injected OpenPay createPayment result */
  openPayResult: {
    ok: boolean;
    providerTxId?: string;
    status?: string;
    raw: unknown;
    error?: string;
  };
  idempotencyKey?: string;
}

export interface StartCheckoutResult {
  ok: boolean;
  paymentId?: string;
  providerTxId?: string;
  error?: string;
  amount?: number;
}

export async function findBlockingPendingPayment(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ id: string } | null> {
  const since = new Date(Date.now() - PENDING_TTL_MS).toISOString();
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'processing'])
    .gte('created_at', since)
    .limit(1)
    .maybeSingle();
  return data ? { id: String(data.id) } : null;
}

export async function startCheckout(
  supabase: SupabaseClient,
  params: StartCheckoutParams
): Promise<StartCheckoutResult> {
  const plan = getPlan(params.planCode);
  if (!plan || !isPaidPlan(params.planCode)) {
    return { ok: false, error: 'Plan non payable via OpenPay' };
  }

  const blocking = await findBlockingPendingPayment(supabase, params.organizationId);
  if (blocking) {
    return {
      ok: false,
      error: 'Un paiement est déjà en cours. Réessayez dans quelques minutes.',
      paymentId: blocking.id,
    };
  }

  const row = {
    organization_id: params.organizationId,
    amount: plan.amountXaf,
    currency: 'XAF',
    provider: 'openpay_cg',
    status: 'pending' as const,
    phone: params.phone,
    provider_network: params.providerNetwork,
    idempotency_key: params.idempotencyKey ?? null,
    metadata: {
      planCode: params.planCode,
      actorId: params.actorId ?? null,
      openPayInit: params.openPayResult.raw ?? null,
    },
    provider_tx_id: params.openPayResult.providerTxId ?? null,
  };

  if (!params.openPayResult.ok) {
    const failed = await supabase
      .from('payments')
      .insert({
        ...row,
        status: 'failed',
        metadata: {
          ...row.metadata,
          error: params.openPayResult.error,
        },
      })
      .select('id')
      .single();

    await supabase.from('payment_logs').insert({
      organization_id: params.organizationId,
      payment_id: failed.data?.id ?? null,
      level: 'error',
      message: params.openPayResult.error ?? 'OpenPay init failed',
      payload: { raw: params.openPayResult.raw },
    });

    return {
      ok: false,
      error: params.openPayResult.error ?? 'Échec initiation OpenPay',
      paymentId: failed.data?.id ? String(failed.data.id) : undefined,
    };
  }

  const { data, error } = await supabase.from('payments').insert(row).select('id').single();
  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from('payment_logs').insert({
    organization_id: params.organizationId,
    payment_id: data.id,
    level: 'info',
    message: 'OpenPay payment initiated',
    payload: { providerTxId: params.openPayResult.providerTxId, raw: params.openPayResult.raw },
  });

  await supabase.from('payment_events').insert({
    organization_id: params.organizationId,
    payment_id: data.id,
    event_type: 'payment.initiated',
    event_id: params.openPayResult.providerTxId
      ? `init:${params.openPayResult.providerTxId}`
      : null,
    payload: { planCode: params.planCode },
  });

  return {
    ok: true,
    paymentId: String(data.id),
    providerTxId: params.openPayResult.providerTxId,
    amount: plan.amountXaf,
  };
}

export async function syncSubscriptionFromPayment(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    paymentId: string;
    providerTxId?: string;
    planCode: PlanCode;
    periodDays?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('apply_openpay_payment_succeeded', {
    p_organization_id: params.organizationId,
    p_payment_id: params.paymentId,
    p_provider_tx_id: params.providerTxId ?? null,
    p_plan_code: params.planCode,
    p_period_days: params.periodDays ?? 30,
  });

  if (error) return { ok: false, error: error.message };

  await supabase.from('payment_events').insert({
    organization_id: params.organizationId,
    payment_id: params.paymentId,
    event_type: 'payment.succeeded',
    event_id: params.providerTxId ? `ok:${params.providerTxId}` : null,
    payload: { planCode: params.planCode },
  });

  return { ok: true };
}

export async function listPayments(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 20
) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listInvoices(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 20
) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', organizationId)
    .order('issued_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getActiveSubscription(
  supabase: SupabaseClient,
  organizationId: string
) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organization_id', organizationId)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
