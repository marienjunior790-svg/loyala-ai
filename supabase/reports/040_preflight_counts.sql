-- Loyala AI — Rapport avant migration 040 : comptages en LECTURE SEULE.
--
-- Une seule requête SELECT : aucune écriture, aucune fonction créée, aucune
-- donnée personnelle affichée (uniquement des totaux et des codes de rôle).
-- Conçue pour le schéma de production actuel (avant 040).
--
-- Exécution (éditeur SQL Supabase, projet de production) : coller TOUT le
-- fichier en une fois, lancer, exporter le résultat (CSV). La première ligne
-- met la transaction en lecture seule : toute écriture serait refusée par
-- PostgreSQL lui-même. Les lignes 6 et 7 (section « execution ») le prouvent
-- dans le résultat : elles doivent valoir 1.
--
-- Colonnes : ordre, section, mesure, valeur, detail. Les lignes « controle_* »
-- doivent valoir 0 : elles vérifient qu'aucune ligne n'est comptée deux fois
-- ni oubliée entre les sous-totaux.

SET TRANSACTION READ ONLY;

WITH
dial(country, code) AS (
  VALUES ('SN', '221'), ('CG', '242'), ('CI', '225'), ('CM', '237'), ('ML', '223'),
         ('BF', '226'), ('BJ', '229'), ('TG', '228'), ('GN', '224'), ('NE', '227'),
         ('GA', '241'), ('CD', '243'), ('CF', '236'), ('TD', '235'), ('GQ', '240'),
         ('AO', '244'), ('ST', '239'), ('MA', '212'), ('NG', '234'), ('FR', '33')
),
orgs AS (
  SELECT id, upper(COALESCE(country_code, '')) AS country, COALESCE(currency, '?') AS currency
  FROM public.organizations
),
visits AS (
  SELECT v.id, v.organization_id, v.client_id, v.kind, v.amount, v.visited_at, v.created_at,
         c.id IS NULL AS orphan_client,
         c.organization_id IS NOT NULL AND c.organization_id <> v.organization_id AS client_other_org
  FROM public.client_visits v
  LEFT JOIN public.clients c ON c.id = v.client_id
),
items_per_visit AS (
  SELECT visit_id, count(*) AS lines, sum(line_total) AS lines_total
  FROM public.visit_items
  GROUP BY visit_id
),
visits_with_items AS (
  SELECT v.id, v.amount, i.lines_total
  FROM public.client_visits v
  JOIN items_per_visit i ON i.visit_id = v.id
),
item_links AS (
  SELECT i.id,
         v.id IS NULL AS orphan_visit,
         v.organization_id IS NOT NULL AND v.organization_id <> i.organization_id AS visit_other_org,
         i.catalog_item_id IS NOT NULL AND ci.organization_id IS NOT NULL
           AND ci.organization_id <> i.organization_id AS catalog_other_org
  FROM public.visit_items i
  LEFT JOIN public.client_visits v ON v.id = i.visit_id
  LEFT JOIN public.catalog_items ci ON ci.id = i.catalog_item_id
),
tx AS (
  SELECT t.id, t.organization_id, t.client_id, t.points_delta, t.reason, t.created_at,
         c.organization_id IS NOT NULL AND c.organization_id <> t.organization_id AS client_other_org,
         t.points_delta > 0 AND t.reason LIKE '% automatique · %' AS automatic
  FROM public.loyalty_transactions t
  LEFT JOIN public.clients c ON c.id = t.client_id
),
-- Même règle de rattachement que la migration 040 (section 3).
candidates AS (
  SELECT t.id AS tx_id, v.id AS visit_id
  FROM tx t
  JOIN public.client_visits v
    ON v.organization_id = t.organization_id
   AND v.client_id = t.client_id
   AND t.points_delta = floor(COALESCE(v.amount, 0) / 1000)
   AND t.created_at BETWEEN v.created_at AND v.created_at + interval '2 minutes'
  WHERE t.automatic
),
unique_pairs AS (
  SELECT c.tx_id
  FROM candidates c
  WHERE (SELECT count(*) FROM candidates x WHERE x.tx_id = c.tx_id) = 1
    AND (SELECT count(*) FROM candidates y WHERE y.visit_id = c.visit_id) = 1
),
-- Totaux tels que la migration 040 les recalcule : toutes les lignes du même
-- restaurant deviennent des commandes payées (passages et dépenses).
client_recalc AS (
  SELECT c.id, c.organization_id, c.visit_count, c.total_spent, c.last_visit_at, c.loyalty_points,
         count(v.id) AS orders,
         COALESCE(sum(COALESCE(v.amount, 0)), 0) AS spent,
         max(v.visited_at) AS last_order_at
  FROM public.clients c
  LEFT JOIN public.client_visits v ON v.client_id = c.id AND v.organization_id = c.organization_id
  GROUP BY c.id, c.organization_id, c.visit_count, c.total_spent, c.last_visit_at, c.loyalty_points
),
client_ledger AS (
  SELECT c.id, c.loyalty_points, COALESCE(sum(t.points_delta), 0) AS ledger
  FROM public.clients c
  LEFT JOIN public.loyalty_transactions t ON t.client_id = c.id AND t.organization_id = c.organization_id
  GROUP BY c.id, c.loyalty_points
),
-- Même règle que normalize_phone_e164 (migration 040), sans créer de fonction.
phones AS (
  SELECT c.id, c.organization_id, o.country, d.code,
         regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') AS digits,
         regexp_replace(COALESCE(c.phone, ''), '^[ \t\r\n]+', '') LIKE '+%' AS has_plus
  FROM public.clients c
  JOIN orgs o ON o.id = c.organization_id
  LEFT JOIN dial d ON d.country = o.country
  WHERE c.deleted_at IS NULL
),
e164 AS (
  SELECT p.id, p.organization_id, p.country, p.code,
         CASE
           WHEN p.digits = '' THEN NULL
           WHEN p.has_plus THEN '+' || p.digits
           WHEN left(p.digits, 2) = '00' THEN '+' || substr(p.digits, 3)
           WHEN p.code IS NULL THEN NULL
           WHEN left(p.digits, length(p.code)) = p.code AND length(p.digits) >= length(p.code) + 8 THEN '+' || p.digits
           WHEN p.country IN ('FR', 'CD', 'MA', 'NG') AND left(p.digits, 1) = '0' THEN '+' || p.code || substr(p.digits, 2)
           ELSE '+' || p.code || p.digits
         END AS e164,
         p.digits = '' AS no_phone
  FROM phones p
),
dup_groups AS (
  SELECT organization_id, e164, count(*) AS n
  FROM e164
  WHERE e164 IS NOT NULL
  GROUP BY organization_id, e164
  HAVING count(*) > 1
),
members AS (
  SELECT m.role_id, lower(btrim(r.code)) AS code
  FROM public.organization_members m
  LEFT JOIN public.roles r ON r.id = m.role_id
  WHERE m.status = 'active'
)

SELECT * FROM (
  SELECT 1 AS ordre, 'base' AS section, 'version_postgres_num' AS mesure,
         current_setting('server_version_num')::NUMERIC AS valeur, current_setting('server_version') AS detail
  UNION ALL SELECT 2, 'base', 'restaurants', count(*), NULL FROM public.organizations
  UNION ALL SELECT 3, 'base', 'clients_total', count(*), NULL FROM public.clients
  UNION ALL SELECT 4, 'base', 'clients_supprimes', count(*), NULL FROM public.clients WHERE deleted_at IS NOT NULL
  -- 1 = la fonction en place renvoie « org_owner » quand le rôle manque (040 la remplace).
  UNION ALL SELECT 5, 'base', 'appartenance_proprietaire_par_defaut',
         CASE WHEN pg_get_functiondef(f.oid) LIKE '%''org_owner''%' THEN 1 ELSE 0 END,
         COALESCE(pg_get_function_result(f.oid), '(fonction absente)')
    FROM (SELECT to_regprocedure('public.get_my_active_membership()') AS oid) f
  -- Preuves d'exécution : doivent valoir 1. Si 0, le résultat n'est pas exploitable
  -- (transaction non protégée, ou rôle soumis au RLS qui ne verrait qu'une partie des lignes).
  UNION ALL SELECT 6, 'execution', 'transaction_lecture_seule',
         CASE WHEN current_setting('transaction_read_only') = 'on' THEN 1 ELSE 0 END,
         current_setting('transaction_read_only')
  UNION ALL SELECT 7, 'execution', 'role_voit_toutes_les_lignes',
         CASE WHEN r.rolsuper OR r.rolbypassrls THEN 1 ELSE 0 END, r.rolname::TEXT
    FROM pg_catalog.pg_roles r WHERE r.rolname = current_user

  -- Passages et dépenses (deviendront des commandes payées « historique »)
  UNION ALL SELECT 10, 'commandes', 'lignes_client_visits_total', count(*), NULL FROM visits
  UNION ALL SELECT 11, 'commandes', 'anciens_passages_kind_visit', count(*), NULL FROM visits WHERE kind = 'visit'
  UNION ALL SELECT 12, 'commandes', 'depenses_kind_expense', count(*), NULL FROM visits WHERE kind = 'expense'
  UNION ALL SELECT 13, 'commandes', 'autres_kind', count(*), string_agg(DISTINCT COALESCE(kind, '(null)'), ', ')
    FROM visits WHERE kind IS NULL OR kind NOT IN ('visit', 'expense')
  UNION ALL SELECT 14, 'commandes', 'controle_total_moins_sous_totaux',
    (SELECT count(*) FROM visits)
    - (SELECT count(*) FROM visits WHERE kind = 'visit')
    - (SELECT count(*) FROM visits WHERE kind = 'expense')
    - (SELECT count(*) FROM visits WHERE kind IS NULL OR kind NOT IN ('visit', 'expense')), NULL
  UNION ALL SELECT 15, 'commandes', 'sans_montant', count(*), NULL FROM visits WHERE amount IS NULL
  UNION ALL SELECT 16, 'commandes', 'montant_cumule_par_devise', COALESCE(sum(v.amount), 0), o.currency
    FROM visits v JOIN orgs o ON o.id = v.organization_id GROUP BY o.currency
  UNION ALL SELECT 17, 'commandes', 'depenses_montant_cumule_par_devise', COALESCE(sum(v.amount), 0), o.currency
    FROM visits v JOIN orgs o ON o.id = v.organization_id WHERE v.kind = 'expense' GROUP BY o.currency

  -- Écarts entre montant enregistré et lignes de plats
  UNION ALL SELECT 20, 'montants_plats', 'commandes_avec_plats', count(*), NULL FROM visits_with_items
  UNION ALL SELECT 21, 'montants_plats', 'montant_egal_somme_plats', count(*), NULL
    FROM visits_with_items WHERE amount = lines_total
  UNION ALL SELECT 22, 'montants_plats', 'montant_different_somme_plats', count(*), NULL
    FROM visits_with_items WHERE amount IS NOT NULL AND amount <> lines_total
  UNION ALL SELECT 23, 'montants_plats', 'montant_absent_avec_plats', count(*), NULL
    FROM visits_with_items WHERE amount IS NULL
  UNION ALL SELECT 24, 'montants_plats', 'ecart_absolu_cumule', COALESCE(sum(abs(amount - lines_total)), 0), NULL
    FROM visits_with_items WHERE amount IS NOT NULL AND amount <> lines_total
  UNION ALL SELECT 25, 'montants_plats', 'controle_sous_totaux',
    (SELECT count(*) FROM visits_with_items)
    - (SELECT count(*) FROM visits_with_items WHERE amount = lines_total)
    - (SELECT count(*) FROM visits_with_items WHERE amount IS NOT NULL AND amount <> lines_total)
    - (SELECT count(*) FROM visits_with_items WHERE amount IS NULL), NULL

  -- Incohérences entre clients et restaurants (conservées, signalées par 040)
  UNION ALL SELECT 30, 'cloisonnement', 'commandes_client_autre_restaurant', count(*), NULL FROM visits WHERE client_other_org
  UNION ALL SELECT 31, 'cloisonnement', 'commandes_client_introuvable', count(*), NULL FROM visits WHERE orphan_client
  UNION ALL SELECT 32, 'cloisonnement', 'plats_commande_autre_restaurant', count(*), NULL FROM item_links WHERE visit_other_org
  UNION ALL SELECT 33, 'cloisonnement', 'plats_commande_introuvable', count(*), NULL FROM item_links WHERE orphan_visit
  UNION ALL SELECT 34, 'cloisonnement', 'plats_catalogue_autre_restaurant', count(*), NULL FROM item_links WHERE catalog_other_org
  UNION ALL SELECT 35, 'cloisonnement', 'points_client_autre_restaurant', count(*), NULL FROM tx WHERE client_other_org
  UNION ALL SELECT 36, 'cloisonnement', 'clients_tenant_id_different', count(*), NULL
    FROM public.clients c
    WHERE to_jsonb(c) ->> 'tenant_id' IS NOT NULL AND to_jsonb(c) ->> 'tenant_id' <> c.organization_id::TEXT

  -- Points de fidélité (la migration ne modifie aucun solde)
  UNION ALL SELECT 40, 'points', 'mouvements_total', count(*), NULL FROM tx
  UNION ALL SELECT 41, 'points', 'mouvements_automatiques', count(*), NULL FROM tx WHERE automatic
  UNION ALL SELECT 42, 'points', 'automatiques_rattachables_a_une_commande', count(*), NULL FROM unique_pairs
  UNION ALL SELECT 43, 'points', 'automatiques_non_rattaches', count(*), NULL
    FROM tx WHERE automatic AND id NOT IN (SELECT tx_id FROM unique_pairs)
  UNION ALL SELECT 44, 'points', 'autres_mouvements_manuels', count(*), NULL FROM tx WHERE NOT automatic
  UNION ALL SELECT 45, 'points', 'controle_sous_totaux',
    (SELECT count(*) FROM tx)
    - (SELECT count(*) FROM unique_pairs)
    - (SELECT count(*) FROM tx WHERE automatic AND id NOT IN (SELECT tx_id FROM unique_pairs))
    - (SELECT count(*) FROM tx WHERE NOT automatic), NULL
  UNION ALL SELECT 46, 'points', 'clients_solde_different_du_journal', count(*), NULL
    FROM client_ledger WHERE loyalty_points <> ledger
  UNION ALL SELECT 47, 'points', 'ecart_absolu_cumule_solde_journal', COALESCE(sum(abs(loyalty_points - ledger)), 0), NULL
    FROM client_ledger WHERE loyalty_points <> ledger

  -- Totaux clients que la migration 040 va recalculer
  UNION ALL SELECT 50, 'totaux_clients', 'nombre_commandes_modifie', count(*), NULL
    FROM client_recalc WHERE visit_count IS DISTINCT FROM orders
  UNION ALL SELECT 51, 'totaux_clients', 'depenses_cumulees_modifiees', count(*), NULL
    FROM client_recalc WHERE total_spent IS DISTINCT FROM spent
  UNION ALL SELECT 52, 'totaux_clients', 'derniere_commande_modifiee', count(*), NULL
    FROM client_recalc WHERE last_visit_at IS DISTINCT FROM last_order_at
  UNION ALL SELECT 53, 'totaux_clients', 'depenses_cumulees_avant_par_devise', COALESCE(sum(r.total_spent), 0), o.currency
    FROM client_recalc r JOIN orgs o ON o.id = r.organization_id GROUP BY o.currency
  UNION ALL SELECT 54, 'totaux_clients', 'depenses_cumulees_apres_par_devise', COALESCE(sum(r.spent), 0), o.currency
    FROM client_recalc r JOIN orgs o ON o.id = r.organization_id GROUP BY o.currency

  -- Consentement WhatsApp (accordé avant → « à confirmer »)
  UNION ALL SELECT 60, 'consentement', 'opt_in_vrai_devient_a_confirmer', count(*), NULL
    FROM public.clients WHERE opt_in_whatsapp IS TRUE
  UNION ALL SELECT 61, 'consentement', 'opt_in_faux_ou_vide_devient_refuse', count(*), NULL
    FROM public.clients WHERE opt_in_whatsapp IS NOT TRUE

  -- Téléphones (clients non supprimés)
  UNION ALL SELECT 70, 'telephones', 'clients_actifs', count(*), NULL FROM e164
  UNION ALL SELECT 71, 'telephones', 'sans_numero', count(*), NULL FROM e164 WHERE no_phone
  UNION ALL SELECT 72, 'telephones', 'format_international_calculable', count(*), NULL FROM e164 WHERE e164 IS NOT NULL
  UNION ALL SELECT 73, 'telephones', 'non_reconnus_pays_non_pris_en_charge', count(*), string_agg(DISTINCT NULLIF(country, ''), ', ')
    FROM e164 WHERE e164 IS NULL AND NOT no_phone
  UNION ALL SELECT 74, 'telephones', 'groupes_de_doublons', count(*), NULL FROM dup_groups
  UNION ALL SELECT 75, 'telephones', 'clients_dans_un_doublon', COALESCE(sum(n), 0), NULL FROM dup_groups
  UNION ALL SELECT 76, 'telephones', 'congo_8_chiffres_sans_0_suspects', count(*), NULL
    FROM e164 WHERE e164 ~ '^\+242[1-9][0-9]{7}$'
  UNION ALL SELECT 77, 'telephones', 'messages_whatsapp_ancien_format_congo', count(*), NULL
    FROM public.whatsapp_messages WHERE phone ~ '^242[1-9][0-9]{7}$'
  UNION ALL SELECT 78, 'telephones', 'sessions_whatsapp_ancien_format_congo', count(*), NULL
    FROM public.conversation_sessions WHERE external_address ~ '^242[1-9][0-9]{7}$'
  UNION ALL SELECT 79, 'telephones', 'contacts_entrants_ancien_format_congo', count(*), NULL
    FROM public.whatsapp_leads WHERE phone_normalized ~ '^242[1-9][0-9]{7}$'

  -- Rôles des membres actifs (droits en base après 040)
  UNION ALL SELECT 80, 'roles', 'membres_actifs', count(*), NULL FROM members
  UNION ALL SELECT 81, 'roles', 'membres_actifs_par_code', count(*), COALESCE(code, '(aucun rôle)')
    FROM members GROUP BY code
  -- Après 040 (refus par défaut), ces membres n'auront plus aucun droit d'écriture.
  UNION ALL SELECT 82, 'roles', 'membres_sans_role_reconnu', count(*), string_agg(DISTINCT COALESCE(code, '(aucun rôle)'), ', ')
    FROM members
    WHERE COALESCE(code, '') NOT IN (
      'org_owner', 'owner', 'proprietaire', 'propriétaire', 'org_admin', 'admin', 'administrateur',
      'gestionnaire_organisation', 'org_manager', 'manager', 'org_staff', 'staff', 'member', 'membre',
      'org_viewer', 'viewer')
) rapport
ORDER BY ordre, detail NULLS FIRST;
