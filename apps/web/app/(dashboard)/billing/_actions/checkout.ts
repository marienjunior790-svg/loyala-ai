'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@loyala/core-iam';
import { checkoutSchema } from '@loyala/validation';
import {
  startCheckout,
  getPlan,
  type PlanCode,
} from '@loyala/domain-billing';
import { createOpenPayClientFromEnv } from '@loyala/integrations';
import { recordDomainEvent } from '@loyala/events';
import { checkRateLimit } from '@/lib/security/rate-limit';

export type CheckoutActionState = {
  error?: string;
  success?: string;
  paymentId?: string;
  redirectTo?: string;
};

export async function startCheckoutAction(
  _prev: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'org:settings')) {
    return { error: 'Permission refusée — owner/admin requis' };
  }

  const limited = await checkRateLimit(`billing:checkout:${ctx.userId}`, {
    limit: 5,
    windowSec: 60,
  });
  if (!limited.ok) {
    return { error: 'Trop de tentatives. Réessayez dans une minute.' };
  }

  if (process.env.BILLING_ENABLED !== 'true') {
    return {
      error:
        'Paiements OpenPay désactivés (BILLING_ENABLED≠true). Contactez le support Loyala.',
    };
  }

  const parsed = checkoutSchema.safeParse({
    planCode: formData.get('planCode'),
    phone: formData.get('phone'),
    providerNetwork: formData.get('providerNetwork'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const { planCode, phone, providerNetwork } = parsed.data;
  const plan = getPlan(planCode);
  if (!plan) return { error: 'Plan inconnu' };

  const supabase = await createClient();
  // Service-role preferred for payment writes; fall back to user client if RLS allows select only.
  // Inserts need service role — use worker proxy or elevate via admin when available.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let writer = supabase;

  if (serviceKey && supabaseUrl) {
    const { createClient: createSb } = await import('@supabase/supabase-js');
    writer = createSb(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as typeof supabase;
  }

  const openPay = createOpenPayClientFromEnv();
  const openPayResult = await openPay.createPayment({
    amount: plan.amountXaf,
    paymentPhoneNumber: phone,
    provider: providerNetwork,
    customerExternalId: ctx.organizationId,
    customer: { phone },
    metadata: {
      organizationId: ctx.organizationId,
      planCode,
      userId: ctx.userId,
    },
  });

  const result = await startCheckout(writer, {
    organizationId: ctx.organizationId,
    planCode: planCode as PlanCode,
    phone,
    providerNetwork,
    actorId: ctx.userId,
    openPayResult: {
      ...openPayResult,
      // attach paymentId after insert via second metadata update — metadata set in startCheckout
    },
    idempotencyKey: `checkout:${ctx.organizationId}:${planCode}:${Date.now()}`,
  });

  if (!result.ok) {
    await recordDomainEvent(writer, {
      organizationId: ctx.organizationId,
      eventType: 'payment.failed',
      aggregateType: 'payment',
      aggregateId: result.paymentId ?? ctx.organizationId,
      actorId: ctx.userId,
      payload: { planCode, error: result.error },
    });
    return { error: result.error ?? 'Échec du paiement' };
  }

  // Enrich OpenPay metadata linkage for webhooks
  if (result.paymentId) {
    await writer
      .from('payments')
      .update({
        metadata: {
          planCode,
          organizationId: ctx.organizationId,
          paymentId: result.paymentId,
          actorId: ctx.userId,
          openPayInit: openPayResult.raw ?? null,
        },
      })
      .eq('id', result.paymentId);
  }

  revalidatePath('/billing');
  revalidatePath('/billing/history');

  return {
    success: 'Paiement initié. Validez sur votre téléphone Mobile Money.',
    paymentId: result.paymentId,
    redirectTo: `/billing/success?paymentId=${result.paymentId ?? ''}`,
  };
}
