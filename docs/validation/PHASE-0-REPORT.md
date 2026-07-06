# Loyala AI — Rapport Phase 0 (Validation & corrections P0)

**Date :** 6 juillet 2026  
**Rôle :** Lead Software Architect / CTO  
**Référence :** `docs/validation/TECHNICAL-AUDIT.md` (hypothèse de travail)  
**Statut :** Phase 0 terminée — causes racines validées, corrections P0 appliquées

---

## Verdict Phase 1

| Critère | Statut |
|---------|--------|
| CRM clients E2E (auth, CRUD, relance manuelle) | ✅ Opérationnel |
| Migrations 008–010 en production | ✅ Confirmé indirectement (accès `/clients` OK post-010) |
| Segmentation « à relancer » | ✅ Corrigé (dérivation + sync DB) |
| RBAC cohérent UI ↔ serveur | ✅ Corrigé sur fiche client |
| Worker / Inngest / campagnes | ⚠️ Construit, non branché au web — **Phase 1** |
| Modules Campagnes / Fidélité / Avis | ⚠️ UI placeholder — **Phase 1** |

**Décision :** La plateforme **peut passer à la Phase 1** (finalisation des modules) pour le périmètre CRM + onboarding. Les promesses campagnes automatisées, IA inbox et billing restent explicitement hors périmètre Phase 0.

---

## Étape 1 — Validation des problèmes P0

### P0-1 — Migrations 008–010 non appliquées en prod

| Champ | Détail |
|-------|--------|
| **Conclusion audit** | Boucles auth, CRM vide si non appliquées |
| **Verdict** | **Confirmé comme risque** ; **partiellement résolu en prod** |

**Preuve technique**

- `supabase/migrations/008_organization_members_status.sql` — ajoute `status` si absent (DB legacy Prisma).
- `supabase/migrations/009_membership_visibility.sql` — policy `members_select_own` + RPC `get_my_active_membership`.
- `supabase/migrations/010_fix_organization_members_rls.sql` — supprime récursion RLS (`auth.user_org_ids()` dans policy sur `organization_members`).
- `apps/web/lib/auth/membership.ts` — appelle `get_my_active_membership`.
- `apps/web/lib/supabase/middleware.ts` — membership via RPC.

**Correction audit :** La migration `001_core_tenant.sql` crée déjà `organization_members.status` sur une install fraîche. La 008 cible les bases **héritées du backend-api Prisma** où `status` peut manquer. Le risque P0 est **conditionnel au schéma prod**, pas universel.

**Cause racine :** Policy RLS récursive sur `organization_members` + absence de RPC SECURITY DEFINER → middleware ne résout pas l'org → redirections / CRM vide.

**Impact utilisateur :** Impossible d'accéder au CRM malgré compte valide.

**Criticité :** P0 (bloquant si présent).

**Stratégie :** Script de vérification read-only `scripts/verify-migrations-phase0.sql`. Pas de modification destructive.

**Correction Phase 0 :** Script ajouté. Prod : accès `/clients` validé en session précédente après application de 010.

---

### P0-2 — Schéma legacy `tenant_id` vs `organization_id`

| Champ | Détail |
|-------|--------|
| **Conclusion audit** | `listClients` échoue |
| **Verdict** | **Confirmé conditionnellement** |

**Preuve technique**

- `packages/domain-crm/src/clients.ts` — toutes les requêtes filtrent sur `organization_id` uniquement.
- `supabase/migrations/002_crm_clients.sql` — table `clients` avec `organization_id` (install Loyala pure).
- `scripts/bloc1-clients-align.sql`, `scripts/align-clients-tenant-id.sql` — backfill `tenant_id → organization_id`.
- Aucune référence `tenant_id` dans `apps/web` ni `packages/domain-crm`.

**Cause racine :** Bases partagées backend-api (Prisma) écrivent `tenant_id` ; le web Loyala lit `organization_id` non backfillé.

**Impact utilisateur :** Liste clients vide ou erreur SQL si colonne absente / non alignée.

**Criticité :** P0 **uniquement** sur DB legacy partagée.

**Stratégie :** Migration officielle additive `011_legacy_tenant_id_align.sql` + trigger sync (pas de suppression de données).

**Correction Phase 0 :** Migration 011 créée. À appliquer **seulement** si `tenant_id` existe (no-op sinon).

---

### P0-3 — Segment client jamais mis à jour

| Champ | Détail |
|-------|--------|
| **Conclusion audit** | Filtre « à relancer » mensonger |
| **Verdict** | **Confirmé à 100 %** |

**Preuve technique**

- `packages/domain-crm/src/clients.ts` — `createClient` n'envoie pas `segment` → DEFAULT `'new'` en DB (`002_crm_clients.sql`).
- `apps/web/components/clients/clients-list.tsx` (avant fix) — filtre sur `segment IN ('inactive','at_risk')`.
- `apps/web/lib/dashboard/crm-metrics.ts` (avant fix) — KPI « À relancer » basé sur `segment` uniquement.
- `apps/worker/src/jobs/campaign-jobs.ts` — `fetchInactiveClientsForRelaunch` utilise `last_visit_at` (seuil 30j) mais **ne persiste pas** `segment`.
- `packages/core-ai/src/engines/segmentation.ts` — `segmentClient()` appelle l'IA ; **non importé par le web**.

**Cause racine :** Deux systèmes parallèles non connectés — (1) colonne `segment` jamais recalculée ; (2) worker détecte l'inactivité via `last_visit_at` sans écrire en DB.

**Impact utilisateur :** Filtre « À relancer » et KPI toujours à 0 ; promesse produit trompeuse.

**Criticité :** P0 métier.

**Stratégie :** Réutiliser le seuil 30j de `detectInactiveClients` / worker (sans nouvelle architecture IA). Dérivation déterministe + `syncClientSegments` au chargement.

**Correction Phase 0 :** Implémentée (voir section Corrections).

---

### P0-4 — Worker / Inngest non connectés au web

| Champ | Détail |
|-------|--------|
| **Conclusion audit** | Promesse campagnes non tenue |
| **Verdict** | **Confirmé** — correction **hors Phase 0** |

**Preuve technique**

- Recherche `WORKER|inngest|core-ai` dans `apps/web` → **0 résultat**.
- `.env.example` — `WORKER_URL` documenté, non consommé par le web.
- `apps/worker/src/index.ts` — expose `/api/inngest`, `/health`, routes `/ai/*`.
- `apps/worker/src/inngest/functions.ts` — cron 08h00, jobs anniversaire + inactifs par org.

**Cause racine :** Intégration web → worker jamais implémentée (gap architectural Blueprint, pas bug isolé).

**Impact utilisateur :** Campagnes automatiques, relances IA et inbox absents du produit web.

**Criticité :** P0 produit pour le Blueprint complet ; **P1** pour le CRM MVP Phase 0.

**Stratégie Phase 1 :** Proxy `WORKER_URL` depuis routes API Next.js ; brancher UI Campagnes sur statuts jobs.

**Correction Phase 0 :** Aucune (documenté). Aucune fonctionnalité supprimée.

---

### P0-5 — RBAC incohérent (bypass MVP vs `hasPermission` UI)

| Champ | Détail |
|-------|--------|
| **Conclusion audit** | Boutons cachés malgré accès serveur |
| **Verdict** | **Confirmé** |

**Preuve technique**

- `apps/web/lib/auth/guard.ts` — bypass `clients:write` pour tout membre actif.
- `apps/web/lib/auth/clients-access.ts` — `canWriteClients` avec même bypass.
- `apps/web/app/(dashboard)/clients/[id]/page.tsx` (avant fix) — `hasPermission(ctx, 'clients:write')` sans bypass.
- Liste `/clients` utilisait `canWriteClients` ; fiche `[id]` utilisait `hasPermission` seul.

**Cause racine :** Deux stratégies d'autorisation UI coexistent sans helper unique.

**Impact utilisateur :** Membre actif peut créer via action serveur mais ne voit pas Modifier / WhatsApp sur la fiche.

**Criticité :** P0 UX / confiance.

**Stratégie :** Helpers centralisés `canWriteClients` / `canDeleteClients` ; suppression sans bypass MVP.

**Correction Phase 0 :** Implémentée. Fallback session `org_owner` → `org_staff` (moins permissif si lookup membre échoue).

---

## Étape 2 — Audit migrations Supabase

### Ordre d'exécution (`scripts/apply-migrations.mjs`)

| # | Fichier | Rôle | Dépendances |
|---|---------|------|-------------|
| 001 | `001_core_tenant.sql` | org, members, roles, events | — |
| 002 | `002_crm_clients.sql` | table `clients`, RLS | 001 |
| 003 | `003_ai_logs.sql` | `ai_request_logs` | 001 |
| 004 | `004_client_date_of_birth.sql` | `date_of_birth` | 002 |
| 005 | `005_ai_metrics_rpc.sql` | RPC métriques IA | 003 |
| 006 | `006_go_live_onboarding_grants.sql` | grants onboarding | 001 |
| 007 | `007_complete_onboarding_rpc.sql` | RPC onboarding | 001, 006 |
| 008 | `008_organization_members_status.sql` | `status` si absent | 001 |
| 009 | `009_membership_visibility.sql` | policy own + RPC | 008 |
| 010 | `010_fix_organization_members_rls.sql` | fix récursion RLS | 009 |
| 011 | `011_legacy_tenant_id_align.sql` | align `tenant_id` legacy | 002 (si legacy) |

### Conflits identifiés

| Conflit | Risque | Mitigation |
|---------|--------|------------|
| 009 et 010 redéfinissent `get_my_active_membership` | Faible | 010 remplace 009 (idempotent) |
| 001 et 008 tous deux touchent `status` | Faible | 008 `IF NOT EXISTS` |
| Scripts `scripts/bloc*.sql` vs migrations officielles | Doublon manuel | Préférer 011 |
| `tenant_id` vs `organization_id` | P0 conditionnel | 011 + trigger sync |

**Aucune migration ne supprime de données utilisateur.**

---

## Étape 3 — Cartographie Worker / IA / Inngest

| Fonctionnalité | Implémenté | Appelé depuis | Gap |
|----------------|------------|---------------|-----|
| CRUD clients | `domain-crm` | web Server Actions | — |
| Relance WhatsApp manuelle | `lib/whatsapp.ts` | UI bouton | Pas de log envoi |
| Segmentation déterministe | `domain-crm/segments.ts` | web (post-P0) | Worker n'écrit pas encore `segment` |
| Segmentation IA (RFM) | `core-ai/segmentation.ts` | worker only | Web non branché |
| Détection inactifs | `core-ai/inactive-detection.ts` | worker `campaign-jobs` | Pas de persistance segment |
| Campagnes anniversaire | `worker/inngest/functions.ts` | Inngest cron | Web UI placeholder |
| Relances auto inactifs | `inactiveRelaunchJob` | Inngest | Web UI placeholder |
| Métriques IA | `/api/metrics/ai` | API existe | Dashboard ne les affiche pas |

Flux : Inngest cron 08h00 → `listActiveOrganizations` → fan-out `BIRTHDAY_RUN` + `INACTIVE_RUN` par org → `runBirthdayCampaignForOrg` / `runInactiveRelaunchForOrg` → `core-ai` automation. **Aucun appel depuis `apps/web`.**

---

## Étape 4 — Audit RBAC

| Couche | clients:read | clients:write | clients:delete |
|--------|--------------|---------------|----------------|
| `guard.ts` | bypass membre actif | bypass membre actif | rôle IAM strict |
| `clients-access.ts` UI | — | bypass membre actif | rôle IAM strict |
| `/clients` page | require read | canWriteClients | — |
| `/clients/[id]` page | require read | canWriteClients | canDeleteClients |
| RLS policies | `auth.user_org_ids()` | idem | idem |

**Incohérence restante (non P0) :** Dashboard affiche « Ajouter un client » sans `canWriteClients`.

---

## Étape 5 — Segmentation

| Question | Réponse |
|----------|---------|
| Où calculer ? | `packages/domain-crm/src/segments.ts` (seuil 30j aligné worker) |
| Quand recalculer ? | Au chargement `/clients` et `getCrmKpis` |
| Pourquoi vides avant ? | `segment` restait à `'new'` ; aucun job ne mettait à jour |
| Données manquantes | `visit_count`, `total_spent` non alimentés par l'app |

---

## Étape 6 — Corrections appliquées

| P0 | Action | Tests |
|----|--------|-------|
| P0-3 | `segments.ts`, sync au chargement, filtres KPI | 5 tests ✅ |
| P0-5 | `canWriteClients` / `canDeleteClients` sur fiche client | permissions ✅ |
| P0-1 | `verify-migrations-phase0.sql` | read-only |
| P0-2 | Migration `011_legacy_tenant_id_align.sql` | si legacy |
| P0-4 | Documenté Phase 1 | — |

```
npx vitest run packages/domain-crm/src/segments.test.ts packages/core-iam/src/permissions.test.ts
→ 10 passed
```

---

## Fichiers créés ou modifiés

**Créés :** `segments.ts`, `segments.test.ts`, `011_legacy_tenant_id_align.sql`, `verify-migrations-phase0.sql`, ce rapport.

**Modifiés :** `domain-crm/index.ts`, `clients-access.ts`, `session.ts`, `crm-metrics.ts`, `clients/page.tsx`, `clients/[id]/page.tsx`, `clients-list.tsx`.

---

## Éléments Phase 1+

1. Brancher `WORKER_URL` depuis le web.
2. Persister `segment` depuis le worker après jobs inactifs.
3. Alimenter `visit_count`, `total_spent`, `date_of_birth`.
4. Finaliser Campagnes, Fidélité, Avis, Paramètres.
5. Persister numéro WhatsApp onboarding.
6. RBAC dashboard + modules futurs.
7. Appliquer 011 si `tenant_id` détecté en prod.
8. Tests RLS CI migrations 008–011.
