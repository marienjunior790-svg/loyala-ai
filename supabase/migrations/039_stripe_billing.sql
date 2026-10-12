-- Loyala AI — Migration 039: Stripe (carte bancaire, Apple Pay, Google Pay)
--
-- The web app verifies the Stripe webhook signature, then calls
-- apply_stripe_billing_event() with the anon key and a shared secret.
-- Only the SHA-256 of that secret is stored here; set it once with:
--   INSERT INTO public.billing_webhook_secrets (provider, secret_hash)
--   VALUES ('stripe', '<sha256 hex of BILLING_WEBHOOK_SECRET>')
--   ON CONFLICT (provider) DO UPDATE SET secret_hash = EXCLUDED.secret_hash, updated_at = now();

CREATE TABLE IF NOT EXISTS public.billing_webhook_secrets (
  provider TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_webhook_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_webhook_secrets FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription
  ON subscriptions ((metadata->>'stripe_subscription_id'))
  WHERE provider = 'stripe';

-- p_event (normalized by apps/web/lib/billing/stripe.ts):
--   eventId, type ('invoice.paid' | 'invoice.payment_failed' | 'subscription.updated' | 'subscription.deleted'),
--   organizationId, planCode, customerId, subscriptionId, invoiceId, invoiceNumber, invoiceUrl,
--   amountCents, currency, periodStart, periodEnd, cancelAt
CREATE OR REPLACE FUNCTION public.apply_stripe_billing_event(p_secret TEXT, p_event JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT := p_event->>'type';
  v_event_id TEXT := NULLIF(p_event->>'eventId', '');
  v_org UUID;
  v_plan TEXT := p_event->>'planCode';
  v_stripe_sub TEXT := NULLIF(p_event->>'subscriptionId', '');
  v_customer TEXT := NULLIF(p_event->>'customerId', '');
  v_start TIMESTAMPTZ := COALESCE(NULLIF(p_event->>'periodStart', '')::timestamptz, now());
  v_end TIMESTAMPTZ := COALESCE(NULLIF(p_event->>'periodEnd', '')::timestamptz, now() + interval '30 days');
  v_amount INT := GREATEST(COALESCE(NULLIF(p_event->>'amountCents', '')::int, 0), 0);
  v_currency TEXT := upper(COALESCE(NULLIF(p_event->>'currency', ''), 'EUR'));
  v_sub_id UUID;
  v_payment_id UUID;
  v_number TEXT;
BEGIN
  IF p_secret IS NULL OR NOT EXISTS (
    SELECT 1 FROM billing_webhook_secrets
    WHERE provider = 'stripe'
      AND secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_org := NULLIF(p_event->>'organizationId', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_org := NULL;
  END;

  IF v_event_id IS NULL OR v_org IS NULL THEN
    RETURN 'ignored';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = v_org) THEN
    RETURN 'unknown_organization';
  END IF;

  INSERT INTO payment_events (organization_id, event_type, event_id, payload)
  VALUES (v_org, 'stripe.' || COALESCE(v_type, 'unknown'), 'stripe:' || v_event_id, p_event)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RETURN 'duplicate';
  END IF;

  IF v_stripe_sub IS NOT NULL THEN
    SELECT id INTO v_sub_id
    FROM subscriptions
    WHERE provider = 'stripe'
      AND organization_id = v_org
      AND metadata->>'stripe_subscription_id' = v_stripe_sub
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_type = 'invoice.paid' THEN
    IF v_plan IS NULL OR v_plan NOT IN ('growth', 'pro') THEN
      RAISE EXCEPTION 'invalid plan code: %', v_plan;
    END IF;

    UPDATE subscriptions
    SET status = 'cancelled', updated_at = now()
    WHERE organization_id = v_org
      AND status IN ('trialing', 'active', 'past_due')
      AND id IS DISTINCT FROM v_sub_id;

    IF v_sub_id IS NULL THEN
      INSERT INTO subscriptions (
        organization_id, plan_code, status, provider, provider_customer_id,
        current_period_start, current_period_end, metadata
      )
      VALUES (
        v_org, v_plan, 'active', 'stripe', v_customer, v_start, v_end,
        jsonb_build_object('stripe_subscription_id', v_stripe_sub)
      )
      RETURNING id INTO v_sub_id;
    ELSE
      UPDATE subscriptions
      SET plan_code = v_plan,
          status = 'active',
          provider_customer_id = COALESCE(v_customer, provider_customer_id),
          current_period_start = v_start,
          current_period_end = v_end,
          updated_at = now()
      WHERE id = v_sub_id;
    END IF;

    INSERT INTO payments (
      organization_id, subscription_id, amount, currency, provider, provider_tx_id, status, metadata
    )
    VALUES (
      v_org, v_sub_id, v_amount, v_currency, 'stripe', NULLIF(p_event->>'invoiceId', ''), 'succeeded',
      jsonb_build_object(
        'planCode', v_plan,
        'stripeSubscriptionId', v_stripe_sub,
        'stripeCustomerId', v_customer
      )
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payment_id;

    UPDATE organizations
    SET plan = v_plan, plan_status = 'active', updated_at = now()
    WHERE id = v_org;

    IF v_payment_id IS NOT NULL THEN
      v_number := COALESCE(
        NULLIF(p_event->>'invoiceNumber', ''),
        'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_payment_id::text, '-', ''), 1, 8)
      );

      INSERT INTO invoices (
        organization_id, payment_id, subscription_id, number, amount, currency, plan_code, status, metadata
      )
      VALUES (
        v_org, v_payment_id, v_sub_id, v_number, v_amount, v_currency, v_plan, 'paid',
        jsonb_build_object(
          'stripe_invoice_id', p_event->>'invoiceId',
          'hosted_invoice_url', p_event->>'invoiceUrl'
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;

    RETURN 'activated';
  END IF;

  IF v_type = 'invoice.payment_failed' THEN
    IF v_sub_id IS NULL THEN
      RETURN 'ignored';
    END IF;

    UPDATE subscriptions
    SET status = 'past_due', updated_at = now()
    WHERE id = v_sub_id AND status IN ('trialing', 'active');

    IF FOUND THEN
      UPDATE organizations
      SET plan_status = 'past_due', updated_at = now()
      WHERE id = v_org AND plan_status = 'active';
    END IF;

    RETURN 'past_due';
  END IF;

  IF v_type = 'subscription.updated' THEN
    IF v_sub_id IS NULL THEN
      RETURN 'ignored';
    END IF;

    UPDATE subscriptions
    SET cancel_at = NULLIF(p_event->>'cancelAt', '')::timestamptz,
        current_period_end = COALESCE(NULLIF(p_event->>'periodEnd', '')::timestamptz, current_period_end),
        updated_at = now()
    WHERE id = v_sub_id;

    RETURN 'updated';
  END IF;

  IF v_type = 'subscription.deleted' THEN
    IF v_sub_id IS NULL THEN
      RETURN 'ignored';
    END IF;

    UPDATE subscriptions
    SET status = 'cancelled', cancel_at = COALESCE(cancel_at, now()), updated_at = now()
    WHERE id = v_sub_id AND status IN ('trialing', 'active', 'past_due');

    IF FOUND THEN
      UPDATE organizations
      SET plan = 'trial', plan_status = 'trialing', updated_at = now()
      WHERE id = v_org;
    END IF;

    RETURN 'cancelled';
  END IF;

  RETURN 'ignored';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_billing_event(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_stripe_billing_event(TEXT, JSONB) TO anon, authenticated, service_role;

INSERT INTO _loyala_migrations (name) VALUES ('039_stripe_billing.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
