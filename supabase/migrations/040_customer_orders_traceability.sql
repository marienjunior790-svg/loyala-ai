-- Loyala AI — Migration 040 : commandes clients, traçabilité et cloisonnement
--
-- Migration additive et rejouable :
--   * chaque ligne de client_visits devient une commande ; aucun passage, montant
--     ou client n'est supprimé. Les anciennes lignes sont « payées », source
--     « historique » ; les anciennes dépenses deviennent des commandes à emporter /
--     livraison (type d'origine conservé dans legacy_kind) ;
--   * historique daté des commandes (création, modification, annulation,
--     remboursement), des mouvements de points (reliés à leur commande) et du
--     consentement WhatsApp ;
--   * clés étrangères composites : une commande, une ligne, un mouvement de points
--     ou un consentement ne peut référencer qu'un client / article du même restaurant ;
--   * fonctions atomiques d'enregistrement, modification, annulation (avec motif)
--     et remboursement. Les commandes ne se suppriment plus : elles s'annulent.

BEGIN;

-- Les reprises de données ne doivent pas modifier updated_at.
CREATE OR REPLACE FUNCTION pg_temp.set_trigger_enabled(tbl REGCLASS, trg TEXT, enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = tbl AND tgname = trg) THEN
    EXECUTE format('ALTER TABLE %s %s TRIGGER %I', tbl, CASE WHEN enabled THEN 'ENABLE' ELSE 'DISABLE' END, trg);
  END IF;
END;
$$;

-- ─── 1. Commandes : nouvelles colonnes ───────────────────────────────────────
-- Les valeurs par défaut posées à l'ajout s'appliquent aux lignes existantes
-- (historique), puis sont remplacées par celles des nouvelles commandes.

ALTER TABLE public.client_visits
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'historique',
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'sur_place',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legacy_kind TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

ALTER TABLE public.client_visits ALTER COLUMN source SET DEFAULT 'manual';

SELECT pg_temp.set_trigger_enabled('public.client_visits', 'client_visits_updated_at', false);

UPDATE public.client_visits
SET legacy_kind = kind
WHERE legacy_kind IS NULL AND source = 'historique';

UPDATE public.client_visits
SET kind = 'visit', order_type = 'a_emporter'
WHERE legacy_kind = 'expense' AND kind = 'expense';

UPDATE public.client_visits
SET subtotal = COALESCE(amount, 0)
WHERE subtotal IS NULL;

SELECT pg_temp.set_trigger_enabled('public.client_visits', 'client_visits_updated_at', true);

ALTER TABLE public.client_visits ALTER COLUMN subtotal SET DEFAULT 0;
ALTER TABLE public.client_visits ALTER COLUMN subtotal SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_status_check') THEN
    ALTER TABLE public.client_visits ADD CONSTRAINT client_visits_status_check
      CHECK (status IN ('paid', 'pending', 'cancelled', 'refunded', 'partially_refunded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_source_check') THEN
    ALTER TABLE public.client_visits ADD CONSTRAINT client_visits_source_check
      CHECK (source IN ('manual', 'historique', 'whatsapp', 'import', 'pos'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_order_type_check') THEN
    ALTER TABLE public.client_visits ADD CONSTRAINT client_visits_order_type_check
      CHECK (order_type IN ('sur_place', 'a_emporter', 'livraison'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_payment_method_check') THEN
    ALTER TABLE public.client_visits ADD CONSTRAINT client_visits_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN ('cash', 'wave', 'orange_money', 'free_money', 'card', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_amounts_check') THEN
    ALTER TABLE public.client_visits ADD CONSTRAINT client_visits_amounts_check
      CHECK (discount_amount >= 0 AND refunded_amount >= 0 AND refunded_amount <= COALESCE(amount, 0))
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_cancel_check') THEN
    ALTER TABLE public.client_visits ADD CONSTRAINT client_visits_cancel_check
      CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND COALESCE(btrim(cancel_reason), '') <> ''));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_visits_org_status_date
  ON public.client_visits (organization_id, status, visited_at DESC);

-- ─── 2. Cloisonnement : clés étrangères composites ───────────────────────────
-- Ajoutées NOT VALID (appliquées aux nouvelles lignes), puis validées sur
-- l'existant. Une ligne historique incohérente ne bloque pas la migration :
-- elle est signalée par un avertissement et la contrainte reste active.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_id_organization_key') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_id_organization_key UNIQUE (id, organization_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_id_organization_key') THEN
    ALTER TABLE public.client_visits ADD CONSTRAINT client_visits_id_organization_key UNIQUE (id, organization_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_items_id_organization_key') THEN
    ALTER TABLE public.catalog_items ADD CONSTRAINT catalog_items_id_organization_key UNIQUE (id, organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_client_same_org_fkey') THEN
    ALTER TABLE public.client_visits ADD CONSTRAINT client_visits_client_same_org_fkey
      FOREIGN KEY (client_id, organization_id) REFERENCES public.clients (id, organization_id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visit_items_order_same_org_fkey') THEN
    ALTER TABLE public.visit_items ADD CONSTRAINT visit_items_order_same_org_fkey
      FOREIGN KEY (visit_id, organization_id) REFERENCES public.client_visits (id, organization_id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visit_items_catalog_same_org_fkey') THEN
    ALTER TABLE public.visit_items ADD CONSTRAINT visit_items_catalog_same_org_fkey
      FOREIGN KEY (catalog_item_id, organization_id) REFERENCES public.catalog_items (id, organization_id)
      ON DELETE SET NULL (catalog_item_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_client_same_org_fkey') THEN
    ALTER TABLE public.loyalty_transactions ADD CONSTRAINT loyalty_transactions_client_same_org_fkey
      FOREIGN KEY (client_id, organization_id) REFERENCES public.clients (id, organization_id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE conname IN (
      'client_visits_amounts_check',
      'client_visits_client_same_org_fkey',
      'visit_items_order_same_org_fkey',
      'visit_items_catalog_same_org_fkey',
      'loyalty_transactions_client_same_org_fkey'
    ) AND NOT convalidated
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.conname);
    EXCEPTION WHEN foreign_key_violation OR check_violation THEN
      RAISE WARNING 'Loyala 040 : % contient des lignes historiques incohérentes (% non validée, appliquée aux nouvelles lignes)', c.tbl, c.conname;
    END;
  END LOOP;
END $$;

-- ─── 3. Points de fidélité reliés à leur commande ────────────────────────────

ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS visit_id UUID,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'historique';

ALTER TABLE public.loyalty_transactions ALTER COLUMN kind SET DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_kind_check') THEN
    ALTER TABLE public.loyalty_transactions ADD CONSTRAINT loyalty_transactions_kind_check
      CHECK (kind IN ('earn', 'reverse', 'adjust', 'manual', 'historique'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_order_same_org_fkey') THEN
    ALTER TABLE public.loyalty_transactions ADD CONSTRAINT loyalty_transactions_order_same_org_fkey
      FOREIGN KEY (visit_id, organization_id) REFERENCES public.client_visits (id, organization_id)
      ON DELETE SET NULL (visit_id);
  END IF;
END $$;

-- Rattachement prudent des points automatiques déjà attribués : même restaurant,
-- même client, points = montant / 1000, écrits dans les 2 minutes suivant la
-- saisie, et un seul candidat possible dans les deux sens. Sinon : non relié.
WITH candidates AS (
  SELECT t.id AS tx_id, v.id AS visit_id
  FROM public.loyalty_transactions t
  JOIN public.client_visits v
    ON v.organization_id = t.organization_id
   AND v.client_id = t.client_id
   AND t.points_delta = floor(COALESCE(v.amount, 0) / 1000)
   AND t.created_at BETWEEN v.created_at AND v.created_at + interval '2 minutes'
  WHERE t.visit_id IS NULL
    AND t.kind = 'historique'
    AND t.points_delta > 0
    AND t.reason LIKE '% automatique · %'
),
unique_pairs AS (
  SELECT c.tx_id, c.visit_id
  FROM candidates c
  WHERE (SELECT count(*) FROM candidates x WHERE x.tx_id = c.tx_id) = 1
    AND (SELECT count(*) FROM candidates y WHERE y.visit_id = c.visit_id) = 1
)
UPDATE public.loyalty_transactions t
SET visit_id = u.visit_id, kind = 'earn'
FROM unique_pairs u
WHERE t.id = u.tx_id;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_transactions_one_earn_per_order
  ON public.loyalty_transactions (visit_id) WHERE kind = 'earn';
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_visit
  ON public.loyalty_transactions (visit_id) WHERE visit_id IS NOT NULL;

-- ─── 4. Clients : consentement WhatsApp daté et téléphone international ──────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_consent TEXT NOT NULL DEFAULT 'refuse',
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_source TEXT,
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

ALTER TABLE public.clients ALTER COLUMN opt_in_whatsapp SET DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_whatsapp_consent_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_whatsapp_consent_check
      CHECK (whatsapp_consent IN ('accorde', 'a_confirmer', 'refuse'));
  END IF;
END $$;

-- Indicatifs : le 0 initial fait partie du numéro au Congo et en Côte d'Ivoire
-- (+242 06…, +225 07…) mais se retire en France, RDC, Maroc et Nigeria
-- (+33 6…, +243 8…). Même règle que packages/integrations/src/phone.ts.
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(raw TEXT, country TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT := regexp_replace(COALESCE(raw, ''), '\D', '', 'g');
  prefix TEXT;
BEGIN
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  IF regexp_replace(raw, '^[ \t\r\n]+', '') LIKE '+%' THEN
    RETURN '+' || digits;
  END IF;
  IF left(digits, 2) = '00' THEN
    RETURN '+' || substr(digits, 3);
  END IF;

  prefix := CASE upper(COALESCE(country, ''))
    WHEN 'SN' THEN '221' WHEN 'CG' THEN '242' WHEN 'CI' THEN '225'
    WHEN 'CM' THEN '237' WHEN 'ML' THEN '223' WHEN 'BF' THEN '226'
    WHEN 'BJ' THEN '229' WHEN 'TG' THEN '228' WHEN 'GN' THEN '224'
    WHEN 'NE' THEN '227' WHEN 'GA' THEN '241' WHEN 'CD' THEN '243'
    WHEN 'CF' THEN '236' WHEN 'TD' THEN '235' WHEN 'GQ' THEN '240'
    WHEN 'AO' THEN '244' WHEN 'ST' THEN '239' WHEN 'MA' THEN '212'
    WHEN 'NG' THEN '234' WHEN 'FR' THEN '33'
    ELSE NULL
  END;
  IF prefix IS NULL THEN
    RETURN NULL;
  END IF;

  IF left(digits, length(prefix)) = prefix AND length(digits) >= length(prefix) + 8 THEN
    RETURN '+' || digits;
  END IF;
  IF upper(country) IN ('FR', 'CD', 'MA', 'NG') AND left(digits, 1) = '0' THEN
    RETURN '+' || prefix || substr(digits, 2);
  END IF;
  RETURN '+' || prefix || digits;
END;
$$;

SELECT pg_temp.set_trigger_enabled('public.clients', 'clients_updated_at', false);

UPDATE public.clients
SET whatsapp_consent = CASE WHEN opt_in_whatsapp THEN 'a_confirmer' ELSE 'refuse' END,
    whatsapp_consent_source = 'historique'
WHERE whatsapp_consent_source IS NULL;

UPDATE public.clients c
SET phone_e164 = public.normalize_phone_e164(c.phone, o.country_code)
FROM public.organizations o
WHERE o.id = c.organization_id
  AND c.phone_e164 IS DISTINCT FROM public.normalize_phone_e164(c.phone, o.country_code);

-- Totaux recalculés depuis les commandes payées (mêmes montants qu'avant).
UPDATE public.clients c
SET visit_count = s.order_count,
    total_spent = s.net_total,
    last_visit_at = s.last_order_at
FROM (
  SELECT cl.id,
         count(v.id) FILTER (WHERE v.status IN ('paid', 'partially_refunded'))::INT AS order_count,
         COALESCE(sum(COALESCE(v.amount, 0) - v.refunded_amount)
           FILTER (WHERE v.status IN ('paid', 'partially_refunded')), 0) AS net_total,
         max(v.visited_at) FILTER (WHERE v.status IN ('paid', 'partially_refunded')) AS last_order_at
  FROM public.clients cl
  LEFT JOIN public.client_visits v ON v.client_id = cl.id AND v.organization_id = cl.organization_id
  GROUP BY cl.id
) s
WHERE s.id = c.id
  AND (c.visit_count, c.total_spent, c.last_visit_at)
      IS DISTINCT FROM (s.order_count, s.net_total, s.last_order_at);

SELECT pg_temp.set_trigger_enabled('public.clients', 'clients_updated_at', true);

CREATE INDEX IF NOT EXISTS idx_clients_org_phone_e164
  ON public.clients (organization_id, phone_e164) WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.client_phone_duplicates
WITH (security_invoker = true) AS
SELECT organization_id,
       phone_e164,
       count(*)::INT AS client_count,
       array_agg(id ORDER BY created_at) AS client_ids
FROM public.clients
WHERE deleted_at IS NULL AND phone_e164 IS NOT NULL
GROUP BY organization_id, phone_e164
HAVING count(*) > 1;

-- ─── 5. Journaux en ajout seul ───────────────────────────────────────────────
-- Écrits uniquement par les déclencheurs ci-dessous : aucune politique
-- d'insertion, de modification ou de suppression pour les utilisateurs.

CREATE TABLE IF NOT EXISTS public.client_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  client_id UUID NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('migrated', 'created', 'updated', 'cancelled', 'refunded')),
  status_after TEXT NOT NULL,
  amount_after NUMERIC(12, 2),
  reason TEXT,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, organization_id)
    REFERENCES public.client_visits (id, organization_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_client_order_events_order
  ON public.client_order_events (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_client_order_events_org_date
  ON public.client_order_events (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.client_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp')),
  consent TEXT NOT NULL CHECK (consent IN ('accorde', 'a_confirmer', 'refuse')),
  source TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (client_id, organization_id)
    REFERENCES public.clients (id, organization_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_client_consent_events_client
  ON public.client_consent_events (client_id, created_at);

ALTER TABLE public.client_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_order_events_select ON public.client_order_events;
CREATE POLICY client_order_events_select ON public.client_order_events
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS client_consent_events_select ON public.client_consent_events;
CREATE POLICY client_consent_events_select ON public.client_consent_events
  FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));

INSERT INTO public.client_order_events
  (organization_id, order_id, client_id, event, status_after, amount_after, reason, changes, created_at)
SELECT v.organization_id, v.id, v.client_id, 'migrated', v.status, v.amount,
       CASE WHEN v.legacy_kind = 'expense'
            THEN 'Ancienne dépense convertie en commande à emporter / livraison'
            ELSE 'Ancien passage repris comme commande payée' END,
       jsonb_build_object('legacy_kind', v.legacy_kind, 'recorded_at', v.created_at),
       now()
FROM public.client_visits v
WHERE v.source = 'historique'
  AND NOT EXISTS (
    SELECT 1 FROM public.client_order_events e WHERE e.order_id = v.id AND e.event = 'migrated'
  );

INSERT INTO public.client_consent_events (organization_id, client_id, consent, source, created_at)
SELECT c.organization_id, c.id, c.whatsapp_consent, 'historique', now()
FROM public.clients c
WHERE c.whatsapp_consent_source = 'historique'
  AND NOT EXISTS (SELECT 1 FROM public.client_consent_events e WHERE e.client_id = c.id);

-- ─── 6. Déclencheurs ─────────────────────────────────────────────────────────

-- Une commande annulée ou remboursée ne revient pas en arrière.
CREATE OR REPLACE FUNCTION public.client_orders_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('cancelled', 'refunded') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Commande % : une commande annulée ou remboursée ne peut plus changer de statut', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.refunded_amount < OLD.refunded_amount THEN
    RAISE EXCEPTION 'Commande % : un remboursement ne peut pas être diminué', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Commande % : le client et le restaurant ne se modifient pas', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_visits_guard ON public.client_visits;
CREATE TRIGGER client_visits_guard
  BEFORE UPDATE ON public.client_visits
  FOR EACH ROW EXECUTE FUNCTION public.client_orders_guard();

CREATE OR REPLACE FUNCTION public.log_client_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT;
  v_changes JSONB;
  v_reason TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'created';
    v_changes := '{}'::jsonb;
  ELSE
    SELECT COALESCE(jsonb_object_agg(o.key, jsonb_build_object('avant', o.value, 'apres', n.value)), '{}'::jsonb)
    INTO v_changes
    FROM jsonb_each(to_jsonb(OLD)) o
    JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
    WHERE o.value IS DISTINCT FROM n.value AND o.key <> 'updated_at';

    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    v_event := CASE
      WHEN NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN 'cancelled'
      WHEN NEW.refunded_amount > OLD.refunded_amount THEN 'refunded'
      ELSE 'updated'
    END;
  END IF;

  v_reason := CASE WHEN v_event = 'cancelled' THEN NEW.cancel_reason
                   ELSE NULLIF(current_setting('loyala.order_reason', true), '') END;

  INSERT INTO public.client_order_events
    (organization_id, order_id, client_id, event, status_after, amount_after, reason, changes, actor_id)
  VALUES
    (NEW.organization_id, NEW.id, NEW.client_id, v_event, NEW.status, NEW.amount, v_reason, v_changes, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_visits_log_event ON public.client_visits;
CREATE TRIGGER client_visits_log_event
  AFTER INSERT OR UPDATE ON public.client_visits
  FOR EACH ROW EXECUTE FUNCTION public.log_client_order_event();

-- Consentement : la date et la source sont posées côté serveur. L'ancien champ
-- opt_in_whatsapp reste l'indicateur « contactable » lu par les campagnes.
CREATE OR REPLACE FUNCTION public.clients_sync_whatsapp_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.whatsapp_consent_source IS NULL THEN
      NEW.whatsapp_consent := CASE WHEN NEW.opt_in_whatsapp THEN 'a_confirmer' ELSE 'refuse' END;
      NEW.whatsapp_consent_source := 'ancien_formulaire';
    END IF;
    NEW.whatsapp_consent_at := now();
  ELSIF NEW.whatsapp_consent IS DISTINCT FROM OLD.whatsapp_consent THEN
    NEW.whatsapp_consent_at := now();
    IF NEW.whatsapp_consent_source IS NOT DISTINCT FROM OLD.whatsapp_consent_source THEN
      NEW.whatsapp_consent_source := 'modification';
    END IF;
  ELSIF NEW.opt_in_whatsapp IS DISTINCT FROM OLD.opt_in_whatsapp THEN
    NEW.whatsapp_consent := CASE WHEN NEW.opt_in_whatsapp THEN 'a_confirmer' ELSE 'refuse' END;
    NEW.whatsapp_consent_source := 'ancien_formulaire';
    NEW.whatsapp_consent_at := now();
  ELSE
    NEW.whatsapp_consent_source := OLD.whatsapp_consent_source;
    NEW.whatsapp_consent_at := OLD.whatsapp_consent_at;
  END IF;
  NEW.opt_in_whatsapp := NEW.whatsapp_consent IN ('accorde', 'a_confirmer');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_whatsapp_consent ON public.clients;
CREATE TRIGGER clients_whatsapp_consent
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_sync_whatsapp_consent();

CREATE OR REPLACE FUNCTION public.log_client_consent_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.whatsapp_consent IS DISTINCT FROM OLD.whatsapp_consent THEN
    INSERT INTO public.client_consent_events (organization_id, client_id, consent, source, actor_id)
    VALUES (NEW.organization_id, NEW.id, NEW.whatsapp_consent, NEW.whatsapp_consent_source, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_log_consent ON public.clients;
CREATE TRIGGER clients_log_consent
  AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_client_consent_event();

CREATE OR REPLACE FUNCTION public.clients_set_phone_e164()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone_e164 := public.normalize_phone_e164(
    NEW.phone,
    (SELECT country_code FROM public.organizations WHERE id = NEW.organization_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_phone_e164 ON public.clients;
CREATE TRIGGER clients_phone_e164
  BEFORE INSERT OR UPDATE OF phone, organization_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_set_phone_e164();

-- Plus de suppression de commande : on annule avec un motif.
DROP POLICY IF EXISTS client_visits_delete ON public.client_visits;

-- ─── 7. Droits par rôle ──────────────────────────────────────────────────────
-- Niveau du rôle de l'appelant dans un restaurant : 100 propriétaire, 80 admin,
-- 60 gérant, 40 équipe, 20 lecture seule, 0 non membre actif. Mêmes codes que
-- apps/web/lib/auth/role-map.ts. Refus par défaut : un membre sans rôle ou avec
-- un code inconnu n'a aucun droit (018/019/027 ont attribué un rôle à chacun).
CREATE OR REPLACE FUNCTION public.current_org_role_level(p_organization_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(max(
    CASE lower(btrim(r.code))
      WHEN 'org_owner' THEN 100 WHEN 'owner' THEN 100
      WHEN 'proprietaire' THEN 100 WHEN 'propriétaire' THEN 100
      WHEN 'org_admin' THEN 80 WHEN 'admin' THEN 80
      WHEN 'administrateur' THEN 80 WHEN 'gestionnaire_organisation' THEN 80
      WHEN 'org_manager' THEN 60 WHEN 'manager' THEN 60
      WHEN 'org_staff' THEN 40 WHEN 'staff' THEN 40
      WHEN 'member' THEN 40 WHEN 'membre' THEN 40
      WHEN 'org_viewer' THEN 20 WHEN 'viewer' THEN 20
      ELSE 0
    END), 0)::INT
  FROM public.organization_members m
  LEFT JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = p_organization_id
    AND m.user_id = auth.uid()
    AND m.status = 'active';
$$;

-- Même règle pour l'application : plus de rôle « propriétaire » implicite
-- (019 renvoyait org_owner quand le rôle manquait). Supprimée d'abord : selon
-- les bases, la version en place ne renvoie que organization_id (009/010/014).
DROP FUNCTION IF EXISTS public.get_my_active_membership();
CREATE FUNCTION public.get_my_active_membership()
RETURNS TABLE (organization_id UUID, role_code TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT om.organization_id, r.code
  FROM organization_members om
  LEFT JOIN roles r ON r.id = om.role_id
  WHERE om.user_id = auth.uid() AND om.status = 'active'
  ORDER BY COALESCE(om.created_at, om.joined_at) ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.assert_org_role(p_organization_id UUID, p_min_level INTEGER, p_action TEXT)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF p_organization_id IS NULL OR public.current_org_role_level(p_organization_id) < p_min_level THEN
    RAISE EXCEPTION 'Action non autorisée : %', p_action USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- Modifier ou annuler une commande : un gérant (ou plus) à tout moment ; un
-- membre de l'équipe seulement sa propre saisie, dans les 15 minutes.
-- Même règle que canChangeOrder (apps/web/lib/auth/clients-access.ts).
CREATE OR REPLACE FUNCTION public.assert_order_change_allowed(
  p_organization_id UUID,
  p_created_by UUID,
  p_created_at TIMESTAMPTZ,
  p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level INTEGER;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  v_level := public.current_org_role_level(p_organization_id);
  IF v_level >= 60 THEN
    RETURN;
  END IF;
  IF v_level >= 40 AND p_created_by = auth.uid() AND p_created_at > now() - INTERVAL '15 minutes' THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Action non autorisée : % (après 15 minutes ou pour la commande d''un autre membre, un gérant doit intervenir)', p_action
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- Points, nombre de commandes et dépenses cumulées sont calculés par les
-- fonctions ci-dessous : un utilisateur connecté ne peut pas les écrire
-- directement (création ou modification d'une fiche client).
CREATE OR REPLACE FUNCTION public.clients_protect_computed_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.loyalty_points, 0) <> 0 OR COALESCE(NEW.visit_count, 0) <> 0
       OR COALESCE(NEW.total_spent, 0) <> 0 OR NEW.last_visit_at IS NOT NULL THEN
      RAISE EXCEPTION 'Points et totaux sont calculés à partir des commandes'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF (NEW.loyalty_points, NEW.visit_count, NEW.total_spent, NEW.last_visit_at)
        IS DISTINCT FROM (OLD.loyalty_points, OLD.visit_count, OLD.total_spent, OLD.last_visit_at) THEN
    RAISE EXCEPTION 'Points et totaux sont calculés à partir des commandes'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_protect_computed_columns ON public.clients;
CREATE TRIGGER clients_protect_computed_columns
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_protect_computed_columns();

-- Commandes, lignes et mouvements de points ne s'écrivent plus qu'au travers
-- des fonctions métier, qui vérifient le restaurant et le rôle.
DROP POLICY IF EXISTS loyalty_tx_insert ON public.loyalty_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.client_visits FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.visit_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_order_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_consent_events FROM anon, authenticated;

-- ─── 8. Fonctions métier ─────────────────────────────────────────────────────
-- SECURITY DEFINER : chaque fonction vérifie d'abord le rôle de l'appelant dans
-- le restaurant, puis ne lit et n'écrit que des lignes de ce restaurant.

CREATE OR REPLACE FUNCTION public.refresh_client_aggregates(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_org_role(
    (SELECT organization_id FROM public.clients WHERE id = p_client_id), 40, 'recalcul des totaux');
  PERFORM public.refresh_client_aggregates_unchecked(p_client_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_aggregates_unchecked(p_client_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.clients c
  SET visit_count = s.order_count,
      total_spent = s.net_total,
      last_visit_at = s.last_order_at
  FROM (
    SELECT count(*)::INT AS order_count,
           COALESCE(sum(COALESCE(amount, 0) - refunded_amount), 0) AS net_total,
           max(visited_at) AS last_order_at
    FROM public.client_visits
    WHERE client_id = p_client_id AND status IN ('paid', 'partially_refunded')
  ) s
  WHERE c.id = p_client_id;
$$;

-- Aligne les points d'une commande sur son montant net (1 point / 1000).
-- Une commande historique sans points reliés n'est pas touchée : on ne retire
-- pas des points dont on ne sait pas s'ils ont été attribués.
CREATE OR REPLACE FUNCTION public.sync_order_loyalty(p_order_id UUID, p_reason TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  o public.client_visits%ROWTYPE;
  v_has_links BOOLEAN;
  v_linked INTEGER;
  v_target INTEGER;
  v_delta INTEGER;
BEGIN
  SELECT * INTO o FROM public.client_visits WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT count(*) > 0, COALESCE(sum(points_delta), 0)::INT
  INTO v_has_links, v_linked
  FROM public.loyalty_transactions
  WHERE visit_id = o.id;

  IF NOT v_has_links AND o.source = 'historique' THEN
    RETURN 0;
  END IF;

  v_target := CASE WHEN o.status IN ('paid', 'partially_refunded')
                   THEN floor(GREATEST(COALESCE(o.amount, 0) - o.refunded_amount, 0) / 1000)::INT
                   ELSE 0 END;
  v_delta := v_target - v_linked;
  IF v_delta = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.loyalty_transactions
    (organization_id, client_id, visit_id, kind, points_delta, reason, created_by)
  VALUES (
    o.organization_id, o.client_id, o.id,
    CASE WHEN NOT v_has_links THEN 'earn' WHEN v_delta < 0 THEN 'reverse' ELSE 'adjust' END,
    v_delta,
    p_reason || ' · ' || CASE WHEN v_delta > 0 THEN '+' ELSE '' END || v_delta || ' pts',
    auth.uid()
  );

  UPDATE public.clients
  SET loyalty_points = loyalty_points + v_delta
  WHERE id = o.client_id AND organization_id = o.organization_id;

  RETURN v_delta;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_order_items(
  p_organization_id UUID,
  p_order_id UUID,
  p_items JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_name TEXT;
  v_catalog UUID;
  v_total NUMERIC := 0;
BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_qty := NULLIF(v_item->>'quantity', '')::NUMERIC;
    v_price := NULLIF(v_item->>'unit_price', '')::NUMERIC;
    v_name := btrim(COALESCE(v_item->>'name', ''));
    v_catalog := NULLIF(v_item->>'catalog_item_id', '')::UUID;

    IF v_name = '' THEN
      RAISE EXCEPTION 'Article sans nom' USING ERRCODE = 'check_violation';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour « % »', v_name USING ERRCODE = 'check_violation';
    END IF;
    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Prix invalide pour « % »', v_name USING ERRCODE = 'check_violation';
    END IF;
    IF v_catalog IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.catalog_items WHERE id = v_catalog AND organization_id = p_organization_id
    ) THEN
      RAISE EXCEPTION 'Article du catalogue introuvable dans ce restaurant' USING ERRCODE = 'foreign_key_violation';
    END IF;

    INSERT INTO public.visit_items
      (organization_id, visit_id, catalog_item_id, name, category_name, item_type, quantity, unit_price, line_total)
    VALUES (
      p_organization_id, p_order_id, v_catalog, v_name,
      NULLIF(btrim(COALESCE(v_item->>'category_name', '')), ''),
      NULLIF(v_item->>'item_type', ''),
      v_qty, v_price, round(v_qty * v_price, 2)
    );
    v_total := v_total + round(v_qty * v_price, 2);
  END LOOP;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_client_order(
  p_organization_id UUID,
  p_client_id UUID,
  p_ordered_at TIMESTAMPTZ,
  p_order_type TEXT,
  p_payment_method TEXT,
  p_items JSONB,
  p_amount NUMERIC,
  p_discount NUMERIC,
  p_notes TEXT,
  p_source TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.client_visits%ROWTYPE;
  v_has_items BOOLEAN := p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0;
  v_subtotal NUMERIC;
  v_discount NUMERIC := COALESCE(p_discount, 0);
  v_points INTEGER;
BEGIN
  PERFORM public.assert_org_role(p_organization_id, 40, 'enregistrement d''une commande');
  IF COALESCE(p_source, 'manual') NOT IN ('manual', 'whatsapp', 'import', 'pos') THEN
    RAISE EXCEPTION 'Source de commande invalide' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = p_client_id AND organization_id = p_organization_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans ce restaurant' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_has_items THEN
    SELECT COALESCE(sum(round((e->>'quantity')::NUMERIC * (e->>'unit_price')::NUMERIC, 2)), 0)
    INTO v_subtotal
    FROM jsonb_array_elements(p_items) e;
  ELSIF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Ajoutez des articles ou un montant' USING ERRCODE = 'check_violation';
  ELSE
    v_subtotal := p_amount;
  END IF;

  IF v_discount < 0 OR v_discount > v_subtotal THEN
    RAISE EXCEPTION 'Remise invalide' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.client_visits
    (organization_id, client_id, kind, visited_at, amount, subtotal, discount_amount,
     status, source, order_type, payment_method, notes, created_by)
  VALUES
    (p_organization_id, p_client_id, 'visit', COALESCE(p_ordered_at, now()),
     v_subtotal - v_discount, v_subtotal, v_discount,
     'paid', COALESCE(p_source, 'manual'), COALESCE(p_order_type, 'sur_place'),
     NULLIF(p_payment_method, ''), NULLIF(btrim(COALESCE(p_notes, '')), ''), auth.uid())
  RETURNING * INTO v_order;

  IF v_has_items THEN
    PERFORM public.insert_order_items(p_organization_id, v_order.id, p_items);
  END IF;

  v_points := public.sync_order_loyalty(v_order.id, 'Commande');
  PERFORM public.refresh_client_aggregates_unchecked(p_client_id);

  RETURN jsonb_build_object('order', to_jsonb(v_order), 'points_delta', v_points);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_client_order(
  p_organization_id UUID,
  p_order_id UUID,
  p_ordered_at TIMESTAMPTZ,
  p_order_type TEXT,
  p_payment_method TEXT,
  p_items JSONB,
  p_amount NUMERIC,
  p_discount NUMERIC,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.client_visits%ROWTYPE;
  v_has_items BOOLEAN;
  v_item_count INTEGER;
  v_subtotal NUMERIC;
  v_discount NUMERIC;
  v_points INTEGER;
BEGIN
  PERFORM public.assert_org_role(p_organization_id, 40, 'modification d''une commande');
  SELECT * INTO o FROM public.client_visits
  WHERE id = p_order_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable dans ce restaurant' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.assert_order_change_allowed(p_organization_id, o.created_by, o.created_at, 'modification d''une commande');
  IF o.status <> 'paid' OR o.refunded_amount > 0 THEN
    RAISE EXCEPTION 'Commande annulée ou remboursée : modification impossible' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('loyala.order_reason', 'Modification de la commande', true);

  v_has_items := p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0;
  SELECT count(*) INTO v_item_count FROM public.visit_items WHERE visit_id = o.id;

  IF v_has_items THEN
    DELETE FROM public.visit_items WHERE visit_id = o.id;
    v_subtotal := public.insert_order_items(p_organization_id, o.id, p_items);
  ELSIF v_item_count = 0 AND p_amount IS NOT NULL THEN
    IF p_amount < 0 THEN
      RAISE EXCEPTION 'Montant invalide' USING ERRCODE = 'check_violation';
    END IF;
    v_subtotal := p_amount;
  ELSE
    v_subtotal := o.subtotal;
  END IF;

  v_discount := COALESCE(p_discount, o.discount_amount);
  IF v_discount < 0 OR v_discount > v_subtotal THEN
    RAISE EXCEPTION 'Remise invalide' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.client_visits
  SET visited_at = COALESCE(p_ordered_at, o.visited_at),
      order_type = COALESCE(p_order_type, o.order_type),
      payment_method = COALESCE(NULLIF(p_payment_method, ''), o.payment_method),
      notes = CASE WHEN p_notes IS NULL THEN o.notes ELSE NULLIF(btrim(p_notes), '') END,
      subtotal = v_subtotal,
      discount_amount = v_discount,
      amount = v_subtotal - v_discount
  WHERE id = o.id
  RETURNING * INTO o;

  v_points := public.sync_order_loyalty(o.id, 'Commande modifiée');
  PERFORM public.refresh_client_aggregates_unchecked(o.client_id);
  PERFORM set_config('loyala.order_reason', '', true);

  RETURN jsonb_build_object('order', to_jsonb(o), 'points_delta', v_points);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_order(
  p_organization_id UUID,
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.client_visits%ROWTYPE;
  v_points INTEGER;
BEGIN
  PERFORM public.assert_org_role(p_organization_id, 40, 'annulation d''une commande');
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Le motif d''annulation est obligatoire' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO o FROM public.client_visits
  WHERE id = p_order_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable dans ce restaurant' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM public.assert_order_change_allowed(p_organization_id, o.created_by, o.created_at, 'annulation d''une commande');
  IF o.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Commande déjà annulée ou remboursée' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.client_visits
  SET status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_reason)
  WHERE id = o.id
  RETURNING * INTO o;

  v_points := public.sync_order_loyalty(o.id, 'Annulation de commande');
  PERFORM public.refresh_client_aggregates_unchecked(o.client_id);

  RETURN jsonb_build_object('order', to_jsonb(o), 'points_delta', v_points);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_client_order(
  p_organization_id UUID,
  p_order_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.client_visits%ROWTYPE;
  v_refunded NUMERIC;
  v_points INTEGER;
BEGIN
  PERFORM public.assert_org_role(p_organization_id, 60, 'remboursement d''une commande (gérant, administrateur ou propriétaire)');
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Le motif du remboursement est obligatoire' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO o FROM public.client_visits
  WHERE id = p_order_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable dans ce restaurant' USING ERRCODE = 'no_data_found';
  END IF;
  IF o.status NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'Seule une commande payée peut être remboursée' USING ERRCODE = 'check_violation';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR o.refunded_amount + p_amount > COALESCE(o.amount, 0) THEN
    RAISE EXCEPTION 'Montant de remboursement invalide' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('loyala.order_reason', btrim(p_reason), true);
  v_refunded := o.refunded_amount + p_amount;

  UPDATE public.client_visits
  SET refunded_amount = v_refunded,
      refunded_at = now(),
      status = CASE WHEN v_refunded >= COALESCE(amount, 0) THEN 'refunded' ELSE 'partially_refunded' END
  WHERE id = o.id
  RETURNING * INTO o;

  v_points := public.sync_order_loyalty(o.id, 'Remboursement');
  PERFORM public.refresh_client_aggregates_unchecked(o.client_id);
  PERFORM set_config('loyala.order_reason', '', true);

  RETURN jsonb_build_object('order', to_jsonb(o), 'points_delta', v_points);
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_loyalty_points(
  p_organization_id UUID,
  p_client_id UUID,
  p_delta INTEGER,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  PERFORM public.assert_org_role(p_organization_id, 60, 'ajustement manuel des points');
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Nombre de points invalide' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Le motif est obligatoire' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.clients
  SET loyalty_points = loyalty_points + p_delta
  WHERE id = p_client_id AND organization_id = p_organization_id AND deleted_at IS NULL
  RETURNING loyalty_points INTO v_balance;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable dans ce restaurant' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.loyalty_transactions
    (organization_id, client_id, kind, points_delta, reason, created_by)
  VALUES (p_organization_id, p_client_id, 'manual', p_delta, btrim(p_reason), auth.uid());

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.current_org_role_level(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_org_role(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_order_change_allowed(UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_active_membership() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_client_aggregates(UUID) FROM PUBLIC, anon;
-- Fonctions internes : appelées uniquement par les fonctions métier ci-dessus.
REVOKE ALL ON FUNCTION public.refresh_client_aggregates_unchecked(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_order_loyalty(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.insert_order_items(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_client_order(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_client_order(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_client_order(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_client_order(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_loyalty_points(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_client_order_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_client_consent_event() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_org_role_level(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_org_role(UUID, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_order_change_allowed(UUID, UUID, TIMESTAMPTZ, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_active_membership() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_client_aggregates(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_client_aggregates_unchecked(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_order_loyalty(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_order_items(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_client_order(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_client_order(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_order(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_client_order(UUID, UUID, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_loyalty_points(UUID, UUID, INTEGER, TEXT) TO authenticated, service_role;

GRANT SELECT ON public.client_order_events TO authenticated;
GRANT SELECT ON public.client_consent_events TO authenticated;
GRANT SELECT ON public.client_phone_duplicates TO authenticated;
GRANT ALL ON public.client_order_events TO service_role;
GRANT ALL ON public.client_consent_events TO service_role;

COMMIT;
