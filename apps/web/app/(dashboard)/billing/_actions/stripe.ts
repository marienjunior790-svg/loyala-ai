'use server';

import { revalidatePath } from 'next/cache';
import type Stripe from 'stripe';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@loyala/core-iam';
import {
  getActiveSubscription,
  getPlan,
  isPaidPlan,
  xafToEurCents,
  type BillingPlan,
  type PlanCode,
} from '@loyala/domain-billing';
import { getStripe } from '@/lib/billing/stripe';
import { isPaymentMethodLive } from '@/lib/billing/payment-methods';
import { getPublicAppUrl } from '@/lib/app-url';
import { checkRateLimit } from '@/lib/security/rate-limit';
import type { CheckoutActionState } from './checkout';

const LIVE_STRIPE_STATUSES = new Set(['active', 'past_due', 'trialing', 'incomplete']);

/** One Stripe product per plan, with a stable id so subscriptions can switch between them. */
async function ensureProduct(stripe: Stripe, plan: BillingPlan): Promise<string> {
  const id = `loyala_${plan.code}`;
  try {
    const product = await stripe.products.retrieve(id);
    if (!product.active) await stripe.products.update(id, { active: true });
    return id;
  } catch (e) {
    if ((e as { code?: string }).code !== 'resource_missing') throw e;
  }
  await stripe.products.create({ id, name: `Loyala ${plan.name}`, description: plan.description });
  return id;
}

function stripeErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  console.error('[billing:stripe]', message);
  return 'Le paiement par carte est momentanément indisponible. Réessayez ou choisissez un autre mode de paiement.';
}

export async function startCardCheckoutAction(
  _prev: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'org:settings')) {
    return { error: 'Permission refusée — owner/admin requis' };
  }

  const limited = await checkRateLimit(`billing:card:${ctx.userId}`, { limit: 5, windowSec: 60 });
  if (!limited.ok) {
    return { error: 'Trop de tentatives. Réessayez dans une minute.' };
  }

  if (!isPaymentMethodLive('card')) {
    return { error: 'Le paiement par carte arrive très bientôt.' };
  }

  const planCode = String(formData.get('planCode') ?? '') as PlanCode;
  const plan = getPlan(planCode);
  if (!plan || !isPaidPlan(planCode)) return { error: 'Plan inconnu' };

  const supabase = await createClient();
  const origin = getPublicAppUrl();
  const metadata = { organizationId: ctx.organizationId, planCode };

  try {
    const stripe = getStripe();
    const product = await ensureProduct(stripe, plan);
    const priceData = {
      currency: 'eur',
      product,
      unit_amount: xafToEurCents(plan.amountXaf),
      recurring: { interval: 'month' as const },
    };

    const current = await getActiveSubscription(supabase, ctx.organizationId).catch(() => null);
    const currentStripeId =
      current?.provider === 'stripe'
        ? ((current.metadata as Record<string, unknown> | null)?.stripe_subscription_id as
            | string
            | undefined)
        : undefined;

    if (currentStripeId) {
      const existing = await stripe.subscriptions.retrieve(currentStripeId);
      const item = existing.items.data[0];
      if (item && LIVE_STRIPE_STATUSES.has(existing.status)) {
        await stripe.subscriptions.update(currentStripeId, {
          items: [{ id: item.id, price_data: priceData }],
          metadata,
          cancel_at_period_end: false,
          proration_behavior: 'always_invoice',
        });
        revalidatePath('/billing');
        return {
          success: `Votre abonnement passe à ${plan.name}.`,
          redirectTo: '/billing/success?provider=stripe&change=1',
        };
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const customerId = current?.provider_customer_id ? String(current.provider_customer_id) : null;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ quantity: 1, price_data: priceData }],
      ...(customerId
        ? { customer: customerId }
        : user?.email
          ? { customer_email: user.email }
          : {}),
      client_reference_id: ctx.organizationId,
      // Charge exactly the euro price shown in Loyala, without Stripe's FX markup.
      adaptive_pricing: { enabled: false },
      metadata,
      subscription_data: { metadata },
      locale: 'fr',
      success_url: `${origin}/billing/success?provider=stripe`,
      cancel_url: `${origin}/billing/checkout?plan=${planCode}`,
    });

    if (!session.url) return { error: stripeErrorMessage('Checkout session without url') };
    return { redirectTo: session.url };
  } catch (e) {
    return { error: stripeErrorMessage(e) };
  }
}

export async function openBillingPortalAction(
  _prev: CheckoutActionState,
  _formData: FormData
): Promise<CheckoutActionState> {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'org:settings')) {
    return { error: 'Permission refusée — owner/admin requis' };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('provider_customer_id')
    .eq('organization_id', ctx.organizationId)
    .eq('provider', 'stripe')
    .not('provider_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const customer = data?.provider_customer_id ? String(data.provider_customer_id) : null;
  if (!customer) return { error: 'Aucun abonnement par carte trouvé.' };

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      locale: 'fr',
      return_url: `${getPublicAppUrl()}/billing`,
    });
    return { redirectTo: session.url };
  } catch (e) {
    return { error: stripeErrorMessage(e) };
  }
}
