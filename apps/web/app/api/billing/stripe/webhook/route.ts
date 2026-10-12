import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/billing/stripe';
import { normalizeStripeEvent } from '@/lib/billing/stripe-events';
import { getSupabaseEnv } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rpcSecret = process.env.BILLING_WEBHOOK_SECRET;
  if (!webhookSecret || !rpcSecret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe billing not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const normalized = normalizeStripeEvent(event);
  if (!normalized) {
    return NextResponse.json({ received: true, result: 'ignored' });
  }

  if ((!normalized.organizationId || !normalized.planCode) && normalized.subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(normalized.subscriptionId);
    normalized.organizationId ??= subscription.metadata.organizationId ?? null;
    normalized.planCode ??= subscription.metadata.planCode ?? null;
  }

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('apply_stripe_billing_event', {
    p_secret: rpcSecret,
    p_event: normalized,
  });

  if (error) {
    console.error('[billing:stripe:webhook]', event.type, event.id, error.message);
    return NextResponse.json({ error: 'Billing update failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true, result: data });
}
