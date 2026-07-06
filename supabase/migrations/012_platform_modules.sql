-- Loyala AI — Migration 012: campaigns, relances, loyalty, reviews, notifications

-- ─── Campaigns ───────────────────────────────────────────────────────────────

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('birthday', 'inactive', 'loyalty', 'promotion', 'manual')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'completed', 'failed')),
  message_preview TEXT,
  target_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_org_created ON campaigns(organization_id, created_at DESC);

-- ─── Campaign sends (relances WhatsApp) ────────────────────────────────────

CREATE TABLE campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'sms', 'email')),
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  whatsapp_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_sends_org_created ON campaign_sends(organization_id, created_at DESC);
CREATE INDEX idx_campaign_sends_client ON campaign_sends(client_id);

-- ─── Loyalty transactions ───────────────────────────────────────────────────

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  points_delta INT NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_tx_org ON loyalty_transactions(organization_id, created_at DESC);

-- ─── Reviews ─────────────────────────────────────────────────────────────────

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'google' CHECK (source IN ('google', 'manual', 'facebook')),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  author_name TEXT NOT NULL DEFAULT 'Client',
  content TEXT NOT NULL,
  review_url TEXT,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_org ON reviews(organization_id, reviewed_at DESC);

-- ─── Notifications ───────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'campaign', 'client', 'loyalty', 'review', 'billing')),
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ─── Triggers ────────────────────────────────────────────────────────────────

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_select ON campaigns
  FOR SELECT USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY campaigns_insert ON campaigns
  FOR INSERT WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY campaigns_update ON campaigns
  FOR UPDATE USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY campaign_sends_select ON campaign_sends
  FOR SELECT USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY campaign_sends_insert ON campaign_sends
  FOR INSERT WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY campaign_sends_update ON campaign_sends
  FOR UPDATE USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY loyalty_tx_select ON loyalty_transactions
  FOR SELECT USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY loyalty_tx_insert ON loyalty_transactions
  FOR INSERT WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY reviews_select ON reviews
  FOR SELECT USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY reviews_insert ON reviews
  FOR INSERT WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY reviews_update ON reviews
  FOR UPDATE USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY reviews_delete ON reviews
  FOR DELETE USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
