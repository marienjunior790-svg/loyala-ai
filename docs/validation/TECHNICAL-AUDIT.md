# Loyala AI — Audit technique complet

**Date :** 6 juillet 2026  
**Rôle :** Lead Software Architect / CTO  
**Périmètre :** Dépôt officiel `loyala-ai` — Blueprint v2.1  
**Statut :** Audit terminé — **aucune modification de code** effectuée dans le cadre de cet audit  

> Tous les modules présents (routes, schéma, migrations, worker, packages) font partie du **périmètre produit officiel**, qu'ils soient complets ou non.

---

## 1. Synthèse exécutive

| Indicateur | Valeur |
|-----------|--------|
| **Maturité globale estimée** | ~35 % du périmètre Blueprint J1–J2 |
| **Modules opérationnels E2E** | Landing, Auth, Onboarding, CRM Clients, Relance WhatsApp manuelle |
| **Modules partiels** | Dashboard, Analytics, API health/metrics |
| **Modules incomplets (UI seule)** | Campagnes, Fidélité, Avis Google, Paramètres |
| **Modules non branchés** | Worker IA, Inngest campagnes, Stripe, emails transactionnels, notifications |
| **Risque P0** | Divergence schéma DB legacy (`tenant_id`) vs migrations ; RLS si 008–010 non appliquées |

**Verdict :** L'application est un **CRM multi-tenant fonctionnel** avec une **plateforme IA/campagnes construite en parallèle mais non intégrée au web**. L'écart entre le marketing/Blueprint et le code déployé est la principale source de dette perçue.

---

## 2. Architecture actuelle (as-built)

### 2.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│  Vercel — apps/web (Next.js 15 App Router, React 19)            │
│  ├─ Middleware : session Supabase + membership RPC + org cookie │
│  ├─ RSC : pages dashboard, CRM, marketing                       │
│  ├─ Client Components : formulaires, listes, shell UI           │
│  ├─ Server Actions : auth, onboarding, clients CRUD              │
│  └─ API : /api/health (public), /api/metrics/ai (auth+RL)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ JWT utilisateur (RLS)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase — PostgreSQL + Auth                                   │
│  organizations · organization_members · clients · domain_events   │
│  ai_request_logs · RPCs (complete_onboarding, get_tenant_ai_*)  │
└────────────────────────────┬────────────────────────────────────┘
                             │ service role (bypass RLS)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Worker — apps/worker (Node HTTP, Railway/Fly)                    │
│  ├─ /api/inngest : cron 08h00 + jobs anniversaire/inactifs      │
│  ├─ /ai/* : orchestration @loyala/core-ai (secret API)          │
│  └─ NON APPELÉ par apps/web (0 référence WORKER_URL)            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Inngest — jobs asynchrones (birthday, inactive relaunch)       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Monorepo (Turborepo + pnpm)

| Chemin | Rôle |
|--------|------|
| `apps/web` | Frontend SaaS (Vercel) |
| `apps/worker` | Worker IA + Inngest |
| `packages/core-iam` | RBAC, `ORG_COOKIE_NAME`, permissions |
| `packages/domain-crm` | CRUD clients via Supabase |
| `packages/core-ai` | Orchestrateur IA, campagnes, RFM, engines (**worker only**) |
| `packages/db` | Factories Supabase |
| `packages/events` | Enveloppe domain events |
| `packages/validation` | Schémas Zod + parse env |
| `packages/ui` | Primitives UI partagées |
| `supabase/migrations/` | 001–010 SQL versionnées |
| `scripts/` | Migrations manuelles, bloc legacy, verify |

### 2.3 Patterns Next.js

| Pattern | Usage |
|---------|--------|
| **App Router** | Toutes les routes sous `app/` |
| **Server Components** | Pages dashboard, marketing, layouts |
| **Client Components** | `'use client'` : formulaires, `clients-list`, shell, nav |
| **Server Actions** | `_actions/auth.ts`, `clients.ts`, `onboarding.ts` |
| **Suspense** | Dashboard avec skeleton |
| **force-dynamic** | `/clients`, `/clients/ajouter` |
| **Middleware** | `middleware.ts` → `lib/supabase/middleware.ts` |

### 2.4 Auth & multi-tenant

| Couche | Fichiers | Comportement |
|--------|----------|--------------|
| Supabase Auth | `lib/supabase/*`, `_actions/auth.ts` | Email/password, callback OAuth |
| Session | `lib/auth/session.ts` | `getSession`, `getAuthContext` + cache React |
| Membership | `lib/auth/membership.ts` | RPC `get_my_active_membership` |
| Guards | `lib/auth/guard.ts` | `requireAuth`, `requireAuthPermission` + bypass MVP CRM |
| Org cookie | `@loyala/core-iam` | `loyala_org_id` httpOnly |
| RBAC | `packages/core-iam/permissions.ts` | Rôles `org_owner` → `org_viewer` |
| Accès clients MVP | `lib/auth/clients-access.ts` | Bypass write pour tout membre actif |

### 2.5 Sécurité (état actuel)

| Mesure | Statut |
|--------|--------|
| Headers sécurité | ✅ `apps/web/vercel.json` (HSTS, X-Frame, etc.) |
| CSP | ❌ Absent |
| RLS PostgreSQL | ✅ Migrations 001–010 (conditionnel prod) |
| Rate limiting | ⚠️ Uniquement `/api/metrics/ai` ; fallback mémoire sans Upstash |
| Worker API auth | ✅ `WORKER_API_SECRET` timing-safe |
| Validation env web au boot | ❌ `parseWebEnv` non appelé |
| Sentry | ❌ Variables dans `.env.example`, non câblé |

---

## 3. Architecture attendue (Blueprint v2.1)

Source : `docs/blueprint/`, `docs/architecture/production-deployment.md`

| Composant | Attendu | Actuel | Écart |
|-----------|---------|--------|-------|
| Web → Worker pour IA lourde | Proxy `WORKER_URL` | Web lit Supabase direct | **Non implémenté** |
| Campagnes WhatsApp automatisées | Worker + Inngest + core-ai | UI placeholder | **Non branché** |
| Inbox IA | core-ai engines | Absent du web | **Non construit** |
| Billing Stripe | J2 roadmap | Aucun code | **Absent** |
| Emails transactionnels | Campagnes, notifications | Supabase Auth only | **Partiel** |
| Analytics & data platform | Marts, KPIs réels | KPIs CRM seuls | **Partiel** |
| Segmentation RFM / inactive | core-ai + worker | Segment DB jamais mis à jour | **Cassé métier** |
| WhatsApp Business API | Intégration officielle | Liens `wa.me` manuels | **MVP manuel** |
| Observabilité | Sentry, logs structurés | Health check seulement | **Minimal** |
| Tests RLS CI | 001–010 couverts | Tests 001–002 seulement | **Insuffisant** |

---

## 4. Inventaire modules — statut détaillé

Légende : ✅ Terminé · ⚠️ Incomplet · 🔴 Cassé / non branché · 📋 Placeholder UI

### 4.1 Landing (`/`)

| Aspect | Statut | Détail |
|--------|--------|--------|
| UI marketing | ✅ | `components/marketing/*` |
| SEO / metadata | ⚠️ | `metadataBase`, OG ; pas d'`og:image` |
| Pricing | ⚠️ | Section statique ; pas de checkout |
| CTA démo WhatsApp | ✅ | `NEXT_PUBLIC_DEMO_WHATSAPP` + normalisation +242 |
| CTA signup | ✅ | `/signup` |

### 4.2 Auth

| Route | Statut | Détail |
|-------|--------|--------|
| `/login` | ✅ | Supabase ; erreurs callback affichées |
| `/signup` | ✅ | Confirmation email ou session immédiate |
| `/forgot-password` | ⚠️ | Fonctionnel ; layout non centré |
| `/reset-password` | ⚠️ | Fonctionnel ; layout non centré |
| `/auth/callback` | ✅ | Exchange code ; redirect `next` |
| Emails | ⚠️ | Supabase SMTP uniquement (config externe) |

### 4.3 Onboarding (`/onboarding`)

| Aspect | Statut | Détail |
|--------|--------|--------|
| Wizard 3 étapes | ⚠️ | UI complète |
| RPC `complete_onboarding` | ✅ | Migration 007 |
| Création org + owner | ✅ | |
| Cookie org | ✅ | |
| Étape WhatsApp | 🔴 | Numéro **jamais persisté** |
| Redirect post-onboarding | ✅ | `/clients/ajouter?welcome=1` |
| Code mort | ⚠️ | `onboarding-form.tsx` inutilisé |

### 4.4 Dashboard (`/dashboard`)

| Aspect | Statut | Détail |
|--------|--------|--------|
| KPIs clients | ✅ | Réels via `getCrmKpis` |
| Graphiques revenus/visites | 📋 | Tableaux vides + empty state |
| Activité récente | 📋 | Toujours vide |
| Métriques IA | 🔴 | Fetchées, **jamais affichées** |
| Badge « Live » | ⚠️ | Hardcodé — trompeur |
| Carte Insight IA | 📋 | Texte template, pas d'IA |

### 4.5 Clients (`/clients/*`)

| Route | Statut | Détail |
|-------|--------|--------|
| `/clients` | ✅ | Liste, recherche locale, filtres |
| `/clients/ajouter` | ✅ | Formulaire création |
| `/clients/new` | ✅ | Redirect legacy |
| `/clients/[id]` | ✅ | Fiche détail |
| `/clients/[id]/edit` | ✅ | Édition |
| Soft delete | ✅ | `deleted_at` |
| Audit events | ⚠️ | Insert `domain_events` — échec bloque UX |
| Filtre « à relancer » | 🔴 | `segment` reste `new` — jamais recalculé |
| `visit_count`, `total_spent` | 📋 | Colonnes DB jamais alimentées par l'app |
| `date_of_birth` | 🔴 | Migration 004 ; absent types/UI |
| Relance WhatsApp | ⚠️ | `wa.me` ; pas de log envoi |

### 4.6 Campagnes (`/campaigns`)

| Aspect | Statut | Détail |
|--------|--------|--------|
| UI web | 📋 | `ComingSoonModule` |
| Worker `campaign-jobs.ts` | 🔴 | Existe ; **non déclenchable depuis UI** |
| Inngest birthday/inactive | 🔴 | Cron 08h00 ; pas de feedback UI |
| Templates WhatsApp | 🔴 | Non implémenté |
| core-ai `campaign-engine` | 🔴 | Package seul |

### 4.7 Fidélité (`/loyalty`)

| Aspect | Statut | Détail |
|--------|--------|--------|
| UI web | 📋 | Coming soon |
| Points / récompenses | 🔴 | Aucune table métier dédiée |
| Worker / IA | 🔴 | Non branché |

### 4.8 Avis Google (`/reviews`)

| Aspect | Statut | Détail |
|--------|--------|--------|
| UI web | 📋 | Coming soon |
| Google Business API | 🔴 | Absent |
| Agrégation avis | 🔴 | Absent |

### 4.9 Analytics IA (`/analytics`)

| Aspect | Statut | Détail |
|--------|--------|--------|
| UI | 📋 | Shell + graphiques vides |
| Segments | 📋 | Placeholder texte |
| RPC `get_tenant_ai_metrics` | ⚠️ | API existe ; UI dashboard ne l'utilise pas |
| core-ai RFM | 🔴 | Non importé par web |

### 4.10 Paramètres (`/settings`)

| Aspect | Statut | Détail |
|--------|--------|--------|
| UI | 📋 | Rôle affiché ; pas d'édition org |
| Équipe / invitations | 🔴 | `team:invite` en IAM ; pas d'UI |
| Intégrations WhatsApp API | 🔴 | Texte statique |
| Facturation | 🔴 | Absent |

### 4.11 Paiement / Stripe

| Aspect | Statut |
|--------|--------|
| Code Stripe | 🔴 **Aucun** |
| Routes checkout/webhook | 🔴 Absent |
| Plans enforcement | 🔴 Sidebar « Plan Growth » hardcodé |
| Docs blueprint | Mentionné J2 (Stripe + Paystack) |

### 4.12 Notifications

| Aspect | Statut |
|--------|--------|
| UI cloche navbar | 📋 Décoratif |
| Push / in-app | 🔴 Absent |
| Email notifications CRM | 🔴 Absent |

### 4.13 Workers & Cron

| Job | Trigger | Statut |
|-----|---------|--------|
| `loyala-daily-campaign-dispatcher` | Cron `0 8 * * *` | 🔴 Worker ; pas visible web |
| `loyala-birthday-campaign` | Event Inngest | 🔴 Idem |
| `loyala-inactive-relaunch` | Event Inngest | 🔴 Idem |
| `loyala/cron.daily.dispatch` | Constante | 🔴 **Jamais émis** |

### 4.14 Intégrations externes

| Intégration | Statut |
|-------------|--------|
| Supabase Auth + DB | ✅ Opérationnel (si migrations OK) |
| WhatsApp `wa.me` | ✅ Manuel |
| WhatsApp Business API | 🔴 |
| OpenAI / Anthropic | ⚠️ Worker only |
| Inngest | ⚠️ Worker only |
| Upstash Redis | ⚠️ Optionnel |
| Stripe / Paystack | 🔴 |
| Google Business | 🔴 |
| Sentry | 🔴 Non câblé |

---

## 5. Migrations Supabase — matrice de dépendance

| # | Fichier | Critique | Dépendants app |
|---|---------|----------|----------------|
| 001 | `001_core_tenant.sql` | **P0** | Tout |
| 002 | `002_crm_clients.sql` | **P0** | CRM |
| 003 | `003_ai_logs.sql` | P1 | Worker logs, metrics |
| 004 | `004_client_date_of_birth.sql` | P2 | Worker birthdays ; web ignore |
| 005 | `005_ai_metrics_rpc.sql` | P1 | `/api/metrics/ai`, dashboard fetch |
| 006 | `006_go_live_onboarding_grants.sql` | **P0** | Grants prod |
| 007 | `007_complete_onboarding_rpc.sql` | **P0** | Onboarding |
| 008 | `008_organization_members_status.sql` | **P0** | Membership active |
| 009 | `009_membership_visibility.sql` | **P0** | RPC membership |
| 010 | `010_fix_organization_members_rls.sql` | **P0** | Fix récursion RLS |

### Scripts hors migrations (legacy)

| Script | Usage | Risque |
|--------|-------|--------|
| `scripts/bloc1-clients-align.sql` | `tenant_id` → `organization_id` | DB pré-Loyala |
| `scripts/bloc2-clients-trigger.sql` | Sync trigger legacy | Idem |
| `scripts/bloc3-clients-rls.sql` | RLS alternatif clients | Diverge de 002 |
| `scripts/fix-clients-rls-inline.sql` | Fix prod manuel | |
| `scripts/fix-organization-members-rls.sql` | Précurseur 010 | |

**Migrations manquantes identifiées (vs Blueprint) :**
- Tables campagnes / envois WhatsApp
- Tables fidélité (points, récompenses)
- Tables avis Google
- Tables billing / abonnements Stripe
- Tables notifications
- Colonnes org : `whatsapp_phone`, settings JSON
- Migration down scripts (rollback L3)

---

## 6. Bugs — classification

### 6.1 P0 — Critiques (bloquent production / confiance)

| ID | Bug | Impact | Fichiers |
|----|-----|--------|----------|
| P0-1 | Migrations 008–010 non appliquées en prod | Boucles auth, CRM vide | `membership.ts`, middleware |
| P0-2 | Schéma legacy `tenant_id` vs `organization_id` | `listClients` échoue | `scripts/bloc*.sql` |
| P0-3 | Segment client jamais mis à jour | Filtre « à relancer » mensonger | `domain-crm`, pas de job segment |
| P0-4 | Worker/Inngest campagnes non connectés au web | Promesse produit non tenue | `apps/worker`, pas d'appel web |
| P0-5 | RBAC incohérent (bypass MVP vs `hasPermission` UI) | Boutons cachés / redirections | `guard.ts`, `[id]/page.tsx`, `clients-access.ts` |

### 6.2 P1 — Majeurs

| ID | Bug | Impact |
|----|-----|--------|
| P1-1 | Onboarding WhatsApp non persisté | Étape trompeuse |
| P1-2 | Dashboard badge « Live » + graphiques vides | Perte confiance restaurateur |
| P1-3 | Métriques IA fetchées mais non affichées | Code mort |
| P1-4 | `getAuthContext` fallback `org_owner` si lookup member échoue | Fausse sécurité |
| P1-5 | Nav mobile : Analytics + Settings absents | `mobile-bottom-nav.tsx` slice(0,5) |
| P1-6 | Campagnes/Loyalty/Reviews sans `requireAuth()` page-level | Défense en profondeur |
| P1-7 | Erreurs CRM affichées en monospace à l'utilisateur | UX pro |
| P1-8 | Web n'appelle jamais Worker malgré doc architecture | Gap doc/code |

### 6.3 P2 — Mineurs

| ID | Bug | Impact |
|----|-----|--------|
| P2-1 | Recherche navbar + ⌘K non fonctionnels | UX |
| P2-2 | Notifications cloche décorative | UX |
| P2-3 | Sidebar « Upgrader » sans action | UX |
| P2-4 | Avatar « Admin » hardcodé | UX |
| P2-5 | `onboarding-form.tsx` mort | Dette |
| P2-6 | KPI `change` affiché comme trend % | Misleading |
| P2-7 | Login → `/dashboard` vs onboarding → `/clients` | Incohérence parcours |
| P2-8 | Pas de `global-error.tsx` | Résilience |
| P2-9 | Delete client via `confirm()`/`alert()` | Polish |
| P2-10 | README migrations liste 001–005 seulement | Doc stale |

---

## 7. Problèmes UX (synthèse)

| Problème | Sévérité | Modules |
|----------|----------|---------|
| Menu 7 entrées dont 4 placeholders | Haute | Nav globale |
| Marketing promet IA/campagnes/analytics | Haute | Landing vs app |
| Parcours « ajouter client » a été confus (routes, boutons) | Haute | Dashboard, Clients |
| Données vides présentées comme « insuffisantes » vs « bientôt » | Moyenne | Dashboard, Analytics |
| Auth pages forgot/reset layout cassé | Moyenne | Auth |
| Liste client : tap ligne vs bouton Voir | Moyenne | Clients |
| Pas de feedback après actions campagnes (inexistantes) | Haute | Campagnes |

---

## 8. Dette technique

| Catégorie | Description | Effort estimé |
|-----------|-------------|---------------|
| **Intégration web ↔ worker** | Proxy API ou jobs déclenchés depuis web | L |
| **Unification RBAC** | Une source de vérité ; retirer bypass ou l'officialiser | M |
| **Segmentation métier** | Brancher core-ai inactive detection OU retirer filtres | M |
| **Schéma DB legacy** | Formaliser migration tenant_id → org_id | M |
| **Tests** | RLS 003–010, E2E parcours CRM, worker jobs | L |
| **Env validation web** | Boot check comme worker | S |
| **Observabilité** | Sentry, logs structurés, tracing | M |
| **Billing** | Stripe Checkout + webhooks + gate features | L |
| **WhatsApp API** | Au-delà de wa.me | XL |
| **Code mort** | onboarding-form, demo metrics path, INNGEST unused event | S |
| **Documentation** | README, runbooks vs code réel | S |

---

## 9. Variables d'environnement — matrice

### Web (Vercel) — requis

| Variable | Requis | Utilisé par |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Middleware, Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Idem |
| `NEXT_PUBLIC_DEMO_WHATSAPP` | Recommandé | Landing CTAs |
| `NEXT_PUBLIC_APP_URL` | Recommandé | Metadata, redirects |

### Web — optionnel / prod

| Variable | Notes |
|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin paths |
| `UPSTASH_REDIS_*` | Rate limit multi-replica |
| `AUTH_DEBUG` | Diagnostics temporaires |
| `WORKER_URL`, `WORKER_API_SECRET` | **Documentés mais non utilisés par web** |
| `SENTRY_*` | Non câblé |
| `OPENAI_*`, `AI_*` | Non utilisés par web |

### Worker (Railway) — requis prod

| Variable | Notes |
|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Jobs + logs |
| `WORKER_API_SECRET` | ≥16 chars |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Jobs |
| `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` | IA |

### Stripe

| Variable | Statut |
|----------|--------|
| `STRIPE_*` | **Non défini dans le repo** |

---

## 10. Performances

| Zone | Évaluation | Notes |
|------|------------|-------|
| Landing `/` | ✅ Bon | Static, ~107 kB First Load |
| RSC + `cache()` session | ✅ | Auth optimisé |
| `force-dynamic` clients | ⚠️ | Nécessaire (cookies) ; pas de cache |
| Bundle dashboard | ✅ | Modéré |
| Rate limit in-memory | ⚠️ | Non scalable multi-replica |
| Worker concurrency | ✅ | Inngest limit 5 |
| Images / fonts | ✅ | Inter `display: swap` |
| N+1 queries dashboard | ⚠️ | KPIs + AI fetch parallèles OK |

---

## 11. Priorités par criticité (plan de remédiation)

### Phase 0 — Fondation (bloquant)

1. **Audit DB prod** : vérifier migrations 001–010 + appliquer si manquant  
2. **Résoudre legacy `tenant_id`** si présent (bloc scripts ou migration officielle)  
3. **Unifier RBAC** : une règle `canManageClients` partout (UI + server + actions)  
4. **Segmentation** : job worker inactive → update `clients.segment` OU retirer filtres UI  

### Phase 1 — Intégration plateforme (Blueprint)

5. **Web → Worker** : route API `/api/ai/*` proxy ou jobs Inngest déclenchables UI  
6. **Campagnes MVP** : UI liste campagnes + statut jobs Inngest existants  
7. **Dashboard honnête** : retirer « Live » ; afficher métriques IA si dispo  
8. **Onboarding** : persister `whatsapp_phone` sur `organizations`  

### Phase 2 — Monétisation & confiance

9. **Stripe** : Checkout + webhook + gate plan  
10. **Paramètres** : édition org, équipe  
11. **Observabilité** : Sentry web + worker  

### Phase 3 — Modules Blueprint complets

12. Fidélité (tables + UI)  
13. Avis Google (OAuth + sync)  
14. WhatsApp Business API  
15. Notifications + emails transactionnels  

---

## 12. Matrice récapitulative modules

| Module | UI | Backend | DB | Worker | Statut global |
|--------|-----|---------|-----|--------|---------------|
| Landing | ✅ | N/A | N/A | N/A | ✅ Opérationnel |
| Auth | ✅ | ✅ Supabase | ✅ | N/A | ✅ Opérationnel |
| Onboarding | ⚠️ | ✅ RPC | ✅ | N/A | ⚠️ Incomplet |
| Dashboard | ⚠️ | ⚠️ | ✅ KPIs | ❌ | ⚠️ Partiel |
| Clients | ✅ | ✅ | ✅ | ❌ | ✅ Opérationnel |
| Relance WA | ✅ wa.me | ❌ API | ❌ logs | ❌ | ⚠️ Partiel |
| Campagnes | 📋 | ❌ web | ❌ | ✅ code | 🔴 Non branché |
| Fidélité | 📋 | ❌ | ❌ | ❌ | 🔴 Non développé |
| Avis Google | 📋 | ❌ | ❌ | ❌ | 🔴 Non développé |
| Analytics IA | 📋 | ⚠️ RPC | ⚠️ | ✅ | 🔴 Non branché |
| Paramètres | 📋 | ❌ | ⚠️ | N/A | 🔴 Non développé |
| Paiement | 📋 marketing | ❌ | ❌ | N/A | 🔴 Absent |
| Notifications | 📋 | ❌ | ❌ | N/A | 🔴 Absent |
| Worker/Inngest | N/A | ✅ | ✅ | ✅ | 🔴 Isolé du web |

---

## 13. Dépendances manquantes (checklist)

- [ ] Migration SQL : `organizations.whatsapp_phone`
- [ ] Migration SQL : tables `campaigns`, `campaign_sends`
- [ ] Migration SQL : tables `loyalty_*`
- [ ] Migration SQL : tables `reviews_*`
- [ ] Migration SQL : `subscriptions` / Stripe customer id
- [ ] Package ou module web : client HTTP worker
- [ ] UI : pages campagnes branchées sur Inngest events
- [ ] Stripe SDK + webhooks
- [ ] WhatsApp Cloud API client
- [ ] Google Business Profile API
- [ ] Service email transactionnel (Resend/SendGrid)
- [ ] Sentry SDK web + worker
- [ ] Tests E2E Playwright parcours restaurateur
- [ ] Job segment : `core-ai` inactive → `domain-crm` update

---

## 14. Conclusion CTO

Le dépôt Loyala AI est une **fondation technique saine** (monorepo, RLS, IAM, CRM, worker IA) mais un **produit partiellement intégré** :

- **Ce qui tient la route :** auth multi-tenant, CRM clients, relance WhatsApp manuelle, landing conversion.  
- **Ce qui existe mais isole :** worker, core-ai, Inngest — prêts pour campagnes mais **invisibles pour l'utilisateur**.  
- **Ce qui est promis mais absent :** Stripe, fidélité, avis, analytics réels, WhatsApp API, notifications.  

**Recommandation :** Ne pas corriger bug par bug. Exécuter le plan **Phase 0 → Phase 1** du §11 pour **brancher la plateforme existante** avant d'ajouter de nouveaux modules UI.

---

## 15. Références fichiers clés

| Domaine | Fichiers |
|---------|----------|
| Auth | `apps/web/lib/auth/session.ts`, `guard.ts`, `middleware.ts` |
| CRM | `packages/domain-crm/src/clients.ts`, `apps/web/app/(dashboard)/clients/` |
| Dashboard | `apps/web/lib/dashboard/metrics.ts`, `crm-metrics.ts` |
| Worker | `apps/worker/src/inngest/functions.ts`, `campaign-jobs.ts` |
| IA | `packages/core-ai/src/` |
| Migrations | `supabase/migrations/001`–`010` |
| Blueprint | `docs/blueprint/BLUEPRINT-v2.1.md` |
| Déploiement | `docs/architecture/production-deployment.md` |

---

*Document généré dans le cadre de l'audit PROMPT 1. Aucun fichier applicatif modifié. Prochaine étape : validation humaine puis plan d'exécution Phase 0.*
