-- Loyala AI — Migration 029: OpenPay Congo billing tables + RLS + RPC

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('trial', 'growth', 'pro')),
  status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  provider TEXT NOT NULL DEFAULT 'openpay_cg',
  provider_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_org
  ON subscriptions(organization_id)
  WHERE status IN ('trialing', 'active', 'past_due');

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_created
  ON subscriptions(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount INT NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  provider TEXT NOT NULL DEFAULT 'openpay_cg',
  provider_tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
  phone TEXT,
  provider_network TEXT CHECK (provider_network IS NULL OR provider_network IN ('MTN', 'AIRTEL')),
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_tx_id
  ON payments(provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency
  ON payments(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_org_created
  ON payments(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  amount INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid'
    CHECK (status IN ('draft', 'paid', 'void')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_event_id
  ON payment_events(event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_events_org ON payment_events(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_created ON payment_logs(created_at DESC);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select ON subscriptions;
CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS payments_select ON payments;
CREATE POLICY payments_select ON payments
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS invoices_select ON invoices;
CREATE POLICY invoices_select ON invoices
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS payment_events_select ON payment_events;
CREATE POLICY payment_events_select ON payment_events
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT public.user_org_ids())
  );

-- No INSERT/UPDATE for authenticated — service_role only for writes
GRANT SELECT ON subscriptions, payments, invoices, payment_events TO authenticated;
GRANT ALL ON subscriptions, payments, invoices, payment_events, payment_logs TO service_role;

-- Apply successful OpenPay payment (service_role / SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.apply_openpay_payment_succeeded(
  p_organization_id UUID,
  p_payment_id UUID,
  p_provider_tx_id TEXT,
  p_plan_code TEXT,
  p_period_days INT DEFAULT 30
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id UUID;
  v_start TIMESTAMPTZ := now();
  v_end TIMESTAMPTZ := now() + make_interval(days => GREATEST(p_period_days, 1));
  v_invoice TEXT;
BEGIN
  UPDATE payments
  SET status = 'succeeded',
      provider_tx_id = COALESCE(p_provider_tx_id, provider_tx_id),
      updated_at = now()
  WHERE id = p_payment_id
    AND organization_id = p_organization_id;

  UPDATE subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE organization_id = p_organization_id
    AND status IN ('trialing', 'active', 'past_due');

  INSERT INTO subscriptions (
    organization_id, plan_code, status, provider,
    current_period_start, current_period_end
  )
  VALUES (
    p_organization_id, p_plan_code, 'active', 'openpay_cg', v_start, v_end
  )
  RETURNING id INTO v_sub_id;

  UPDATE payments SET subscription_id = v_sub_id WHERE id = p_payment_id;

  -- Bypass plan lock: run as definer (postgres / supabase)
  UPDATE organizations
  SET plan = p_plan_code,
      plan_status = 'active',
      updated_at = now()
  WHERE id = p_organization_id;

  v_invoice := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(p_payment_id::text, '-', ''), 1, 8);

  INSERT INTO invoices (
    organization_id, payment_id, subscription_id, number, amount, currency, plan_code, status
  )
  SELECT
    p.organization_id, p.id, v_sub_id, v_invoice, p.amount, p.currency, p_plan_code, 'paid'
  FROM payments p
  WHERE p.id = p_payment_id
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_subscription_past_due(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE subscriptions
  SET status = 'past_due', updated_at = now()
  WHERE organization_id = p_organization_id
    AND status = 'active'
    AND current_period_end IS NOT NULL
    AND current_period_end < now();

  UPDATE organizations
  SET plan_status = 'past_due', updated_at = now()
  WHERE id = p_organization_id
    AND plan_status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_openpay_payment_succeeded TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_subscription_past_due TO service_role;

CREATE TABLE IF NOT EXISTS _loyala_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _loyala_migrations (name) VALUES ('029_openpay_billing.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
