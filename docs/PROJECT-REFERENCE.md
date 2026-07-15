# Loyala AI — Référence projet (audit code, 2026-07-15)

> **Source de vérité :** code actuel, Git, configurations de déploiement.  
> Ce document remplace tout contexte historique (sprints, plans, hypothèses) pour les futures tâches.

---

## 1. Résumé global

**Loyala AI** est une plateforme SaaS B2B française de **fidélisation et CRM pour restaurants**. Elle permet de gérer des clients, segments, campagnes marketing (notamment WhatsApp), relances, fidélité, avis et analytics, avec assistance IA.

| Élément | Valeur |
|---------|--------|
| Repo | `https://github.com/marienjunior790-svg/loyala-ai.git` |
| Branche principale | `main` (commit `662dfe2` au moment de l'audit) |
| URL production web | `https://fmagence.online` |
| Stack | Next.js 15 + Node worker + Supabase + Inngest + Vercel + Railway |
| Langue UI | Français |
| Cible | Restaurants (Afrique centrale notamment, pays configurables) |

**État général :** Le cœur produit (auth, onboarding, CRM clients, campagnes, relances, fidélité) est **implémenté et déployé**. Les intégrations avancées (paiement Stripe, Google Reviews API, invitation équipe, envoi WhatsApp massif) sont **partielles ou absentes**.

---

## 2. Architecture

### 2.1 Monorepo

```
loyala-ai/
├── apps/
│   ├── web/          # Next.js 15 App Router (port 3000)
│   └── worker/       # Node HTTP + Inngest + AI + WhatsApp (port 3001 dev, 3000 prod Docker)
├── packages/
│   ├── core-ai/      # Orchestration IA (OpenAI, Anthropic, mock)
│   ├── core-iam/     # RBAC statique (5 rôles, permissions)
│   ├── db/           # Factories clients Supabase (browser/server/admin)
│   ├── domain-crm/   # Couche métier CRM (repos Supabase)
│   ├── events/       # Enveloppe événements domaine (Zod, pas de bus)
│   ├── integrations/ # Email (Resend), storage, Meta WhatsApp, monitoring
│   ├── messaging/    # Routeur messages (WhatsApp API vs wa.me)
│   ├── ui/           # Tokens + Button + cn()
│   └── validation/   # Schémas Zod + audit env
├── supabase/migrations/  # 23 fichiers SQL (001–024)
├── scripts/          # ~81 scripts ops (migrations, Inngest, Hostinger…)
└── docs/             # ADR, blueprint, runbooks (peuvent être dépassés)
```

**Gestionnaire :** pnpm 9.15, Node ≥ 20, Turbo 2.x.  
**Particularité :** Les packages n'ont pas de build `dist/` — consommation directe du TypeScript source.

### 2.2 Flux applicatif

```
Utilisateur → fmagence.online (Vercel, Next.js)
                │
                ├─ Supabase Auth + PostgreSQL (RLS multi-tenant)
                │
                └─ Proxy /api/ai/* → Worker Railway
                        │
                        ├─ OpenAI / Anthropic (core-ai)
                        ├─ Inngest (crons campagnes)
                        ├─ Meta WhatsApp Graph API
                        └─ Resend (emails admin)
```

### 2.3 Multi-tenancy

- **Organisation** = tenant
- **Isolation** : Row Level Security PostgreSQL via `public.user_org_ids()`
- **Cookie** `loyala_org_id` (httpOnly) pour l'org active
- **Onboarding** : RPC `complete_onboarding()` crée org + membership `org_owner`
- **Membership** : RPC `get_my_active_membership()` retourne `(organization_id, role_code)`

### 2.4 Rôles IAM (`@loyala/core-iam`)

| Rôle | Permissions clés |
|------|------------------|
| `org_owner` | Tout |
| `org_admin` | Tout sauf `org:delete` |
| `org_manager` | CRM write, campagnes, analytics |
| `org_staff` | CRM write limité |
| `org_viewer` | Lecture seule |

**Bypass MVP formalisé :** `CRM_MVP_CLIENTS_BYPASS` (défaut `true`) — tout membre actif peut écrire des clients. Mettre `false` pour RBAC strict. Delete = toujours `clients:delete` uniquement.

---

## 3. Applications

### 3.1 `apps/web` — Frontend Next.js

**Routes publiques :**
- `/` — Landing marketing
- `/login`, `/signup`, `/forgot-password`, `/reset-password`
- `/auth/callback` — OAuth Supabase

**Routes authentifiées :**
- `/onboarding` — Création organisation (2 étapes)
- `/dashboard` — KPIs, graphiques, activité récente
- `/clients`, `/clients/ajouter`, `/clients/[id]`, `/clients/[id]/edit`
- `/segments` — Segments clients (new/regular/vip/inactive/at_risk)
- `/relances` — Historique envois WhatsApp + statuts Meta
- `/campaigns` — CRUD campagnes + génération IA
- `/loyalty` — Points fidélité
- `/reviews` — Avis (saisie manuelle + réponse IA)
- `/analytics` — Analytics étendus + coûts IA
- `/notifications` — Notifications in-app
- `/billing` — Affichage plan (pas de paiement en ligne)
- `/administration` — Org + équipe (lecture seule, admin only)
- `/settings` — Paramètres org + logo

**API routes :**
- `GET /api/health` — Santé web + Supabase + worker
- `GET /api/metrics/ai` — Métriques IA tenant
- `GET|POST /api/ai/*` (10 routes) — Proxy vers worker (auth session + rate limit)

**Middleware :** Refresh session Supabase, redirection auth/org. Les routes `/api/*` sont **exclues** du middleware.

**Packages utilisés :** core-iam, db, domain-crm, events, integrations, ui, validation. **Pas** core-ai ni messaging.

### 3.2 `apps/worker` — Backend jobs

**Endpoints HTTP :**
| Route | Auth | Rôle |
|-------|------|------|
| `GET /` | Non | Index JSON |
| `GET /health` | Non | Santé + statut Inngest/AI/WhatsApp |
| `* /api/inngest` | Signature Inngest | Handler crons/événements |
| `* /ai/*` (10 routes) | `WORKER_API_SECRET` | Endpoints IA |
| `POST /whatsapp/send-test` | Bearer secret | Test envoi WhatsApp |
| `GET|POST /whatsapp/webhook` | Verify token / HMAC | Webhook Meta |

**Jobs Inngest :**
| Fonction | Trigger | Action |
|----------|---------|--------|
| `loyala-daily-campaign-dispatcher` | Cron 08:00 UTC | Fan-out anniversaire + inactifs |
| `loyala-birthday-campaign` | Event | Campagne anniversaire par org |
| `loyala-inactive-relaunch` | Event | Relance clients inactifs (RFM + IA) |
| `loyala-scheduled-campaign-executor` | Cron */15 min | Campagnes planifiées utilisateur |

**Déploiement :** Docker multi-stage (`apps/worker/Dockerfile`), bundle esbuild → `server.mjs`, Railway via `railway.toml` racine.

---

## 4. Packages — détail

| Package | Maturité | Rôle |
|---------|----------|------|
| `core-ai` | Élevée | Orchestration IA complète, providers OpenAI/Anthropic/mock, cache mémoire, RFM, campagnes |
| `core-iam` | Complète (scope limité) | RBAC pur, pas de session |
| `db` | Minimale | 3 factories Supabase |
| `domain-crm` | Élevée | 15 modules CRM + WhatsApp persistence |
| `events` | Minimale | Schéma enveloppe, catalogue P0, pas de bus |
| `integrations` | Réelle (sauf Twilio) | Resend, Meta WhatsApp, storage, heartbeats |
| `messaging` | Réelle (WhatsApp) | Routeur API vs wa.me, templates, sessions 24h |
| `ui` | Minimale | Button + tokens + cn() |
| `validation` | Élevée | Zod auth/clients/visits + audit env production |

---

## 5. Base de données

### 5.1 Tables (23 migrations, 001–024)

**IAM :** `organizations`, `roles`, `organization_members`, `domain_events`, `_loyala_migrations`

**CRM :** `clients`, `client_visits`, `campaigns`, `campaign_sends`, `loyalty_transactions`, `reviews`, `notifications`

**IA/Messaging :** `ai_request_logs`, `whatsapp_messages`, `conversation_sessions`, `message_template_catalog`

**Storage :** bucket `org-assets` (logos publics via URL ; RLS API scopée par `{org_id}/` depuis migration 025)

### 5.2 RPCs

- `complete_onboarding(name, country, tz, currency)`
- `get_my_active_membership()` → `(organization_id, role_code)`
- `get_tenant_ai_metrics(org_id, since)`
- `auth.user_org_ids()` + `public.user_org_ids()` (dual, dette)

### 5.3 Application migrations

- **Canonique :** `pnpm db:migrate` → `scripts/apply-migrations.mjs` (toutes les migrations, tracker `_loyala_migrations`)
- **Ciblées :** `pnpm db:apply-019` … `db:apply-024`, `db:apply-phase1-whatsapp`
- **Attention :** `apply-migration-file.mjs` ne met pas à jour le tracker

---

## 6. Variables d'environnement

### Web (Vercel) — critiques

| Variable | Requis prod | Rôle |
|----------|-------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Oui | Auth client |
| `NEXT_PUBLIC_APP_URL` | Recommandé | `https://fmagence.online` |
| `WORKER_URL` | Oui (IA) | URL worker Railway |
| `WORKER_API_SECRET` | Oui (IA) | Auth proxy → worker |
| `SUPABASE_SERVICE_ROLE_KEY` | Optionnel web | Admin côté serveur si besoin |

### Web — optionnelles (état prod actuel)

| Variable | Prod actuel | Impact |
|----------|-------------|--------|
| `RESEND_API_KEY` | ❌ Absent | Pas d'email transactionnel |
| `UPSTASH_REDIS_REST_URL/TOKEN` | ❌ Absent (ops) | Code prêt — voir `docs/runbooks/upstash-rate-limit.md` |
| `AUTH_DEBUG` | ⚠️ `=1` sur Vercel (ops) | Code : no-op forcé en prod (`debug.ts`) ; mettre `0` sur Vercel |
| `STRIPE_SECRET_KEY` | ❌ Non utilisé | Aucun code Stripe |

### Worker (Railway) — critiques prod

| Variable | Requis | Rôle |
|----------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | DB |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui | Admin client |
| `WORKER_API_SECRET` | Oui | Auth API |
| `INNGEST_EVENT_KEY` | Oui | Inngest event key |
| `INNGEST_SIGNING_KEY` | Oui | Inngest signing key |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Oui | IA |

### Worker — WhatsApp (si `WHATSAPP_API_ENABLED=true`)

`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_TEST_CLIENT_ID` ou `WHATSAPP_TEST_PHONE` (auto-send gated)

---

## 7. Déploiement réel

| Composant | Plateforme | Config |
|-----------|------------|--------|
| Web | **Vercel** (région `cdg1`) | `apps/web/vercel.json`, domaine `fmagence.online` |
| Worker | **Railway** (Docker) | `railway.toml` racine, service `loyala-worker` |
| DB | **Supabase** | Migrations SQL manuelles ou script |
| Jobs | **Inngest Cloud** | Worker `/api/inngest` |
| Rate limit | **Upstash** (optionnel) | Non configuré en prod |
| Email | **Resend** (optionnel) | Non configuré en prod |

**Hostinger :** Pipeline d'export local existant (`HOSTINGER_DEPLOY.md`, scripts) mais **non commité** sur `main`. Alternative explorée, pas production actuelle.

**CI/CD GitHub Actions :**
- `ci.yml` : typecheck, tests, build sur PR/push main
- `cd.yml` : smoke production post-merge (pas de deploy automatique)

**Santé production (2026-07-15) :**
```json
{
  "status": "ok",
  "version": "8c2276e",
  "checks": { "env": "ok", "supabase": "ok", "worker": "ok" },
  "worker": { "reachable": true, "inngest": true }
}
```

---

## 8. Fonctionnalités — matrice

### ✅ Terminées et en production

- Auth email/password Supabase (signup, login, reset, callback)
- Onboarding organisation
- CRM clients complet (CRUD, soft delete, visites, dépenses)
- Segmentation déterministe + sync
- Campagnes (CRUD, planification, duplication, pause, IA génération)
- Relances WhatsApp (wa.me + tracking Meta si webhook)
- Fidélité (points, ajustements manuels)
- Avis (saisie manuelle + réponse + suggestion IA)
- Notifications in-app
- Analytics + métriques IA
- Paramètres org + upload logo
- Worker IA (10 endpoints)
- Inngest crons (campagnes quotidiennes + planifiées)
- Meta WhatsApp (envoi test, webhook, sessions 24h, templates)
- Landing marketing + SEO (sitemap, robots, manifest)
- Sécurité headers (CSP, HSTS, X-Frame-Options)

### 🔄 En cours / partielles

- WhatsApp auto-send (gated : test client/phone uniquement)
- Templates Meta (catalogue DB, statut `pending_approval`)
- Administration équipe (lecture seule, IDs tronqués)
- RBAC (permissions définies ; bypass CRM formalisé via `CRM_MVP_CLIENTS_BYPASS`)
- Rate limiting (fallback mémoire en prod tant qu'Upstash absent sur Vercel)
- Branche `fix/auth-rsc-session` : **abandonner** (déjà dans `main` @ `0d9264d`)

### ❌ Manquantes

- Paiement Stripe/Paystack (variable env seulement, UI = WhatsApp)
- Google Reviews API (label UI trompeur, saisie manuelle)
- Invitation collaborateurs (`team:invite` sans UI)
- Recherche globale (placeholder ⌘K)
- Gestion rôles membres (UI)
- Event bus / consumers Inngest pour domain events
- Twilio (stub qui throw)
- SMS / email / RCS channels (messaging)
- Sentry (variable env, pas d'intégration code)
- ABAC (mentionné ADR, non implémenté)

---

## 9. Tests

**30 fichiers de test, 139 tests :** 135 passent, 1 échoue (smoke prod timeout), 3 skipped (RLS integration sans secrets).

Couverture forte : messaging, WhatsApp webhooks, core-ai, domain-crm, env validation.  
Couverture faible : E2E parcours utilisateur, RLS tables récentes (021–024), storage policies.

---

## 10. Dette technique prioritaire

1. Dual `auth.user_org_ids()` vs `public.user_org_ids()` — tables legacy (002, 003 origine) ; **025 corrige ai_request_logs**
2. Scripts ops non commités (~38 fichiers locaux)
3. ~~`.env.example` incomplet~~ → complété (Resend, WhatsApp, CRM bypass, Upstash)
4. Tracker migrations : `audit-supabase-migrations.mjs` lit désormais le FS 001→N + critiques 020–025
5. ~~Storage `org-assets` write non scopé par org~~ → corrigé migration 025
6. Packages sans build dist / turbo build no-op
7. Lint placeholder partout (`echo "lint ok"`)
8. Documentation `docs/` potentiellement dépassée vs code

---

## 11. Sécurité — points d'attention

| Risque | Sévérité | Détail |
|--------|----------|--------|
| `AUTH_DEBUG=1` en prod | Moyenne | Code ignore les logs en prod ; retirer la var Vercel pour supprimer le warning health |
| Rate limit mémoire | Moyenne | Configurer Upstash sur Vercel (code prêt) |
| ~~Storage write global~~ | ~~Moyenne~~ | Corrigé migration 025 (isolation par dossier org) |
| Worker auth dev bypass | Basse (dev) | Secret absent = auth off hors prod |
| CSP `unsafe-inline/eval` | Basse | Requis Next.js mais affaiblit CSP |
| MVP clients write bypass | Documenté | Flag `CRM_MVP_CLIENTS_BYPASS` (défaut on) — `clients-access.ts` |

---

## 12. Commandes essentielles

```bash
cd C:\Users\HP\Projects\loyala-ai
pnpm install
pnpm dev              # web :3000
pnpm dev:worker       # worker :3001
pnpm test             # vitest (135+ tests)
pnpm test:rls         # tests RLS (nécessite secrets Supabase)
pnpm build            # build web + worker
pnpm db:migrate       # migrations Supabase (DATABASE_URL requis)
pnpm ops:phase1       # ops WhatsApp Phase 1
pnpm verify:prod      # vérification production
```

---

## 13. Historique Git récent (tendance)

Derniers commits (juillet 2026) :
- WhatsApp Phase 1 (migrations 022–024, message router, webhooks, templates)
- Campagnes planifiées via Inngest cron
- Visites clients (migration 021)
- Domaine production `fmagence.online`
- Fixes CRM schema (migrations 019–020)
- Railway worker Docker bundle

**Branche `fix/auth-rsc-session` :** abandonner — commit `0d9264d` déjà ancestral de `main`, aucun diff unique. Voir `scripts/README.md`.

**Fichiers locaux non commités :** scripts Hostinger/zip (catalogue dans `scripts/README.md`), correctifs P0/P1 locaux.

---

## 14. Recommandations prioritaires

### P0 — Immédiat
1. Désactiver `AUTH_DEBUG` sur Vercel (`AUTH_DEBUG=0`) — défense code : `apps/web/lib/auth/debug.ts`
2. Configurer Upstash Redis sur Vercel — `docs/runbooks/upstash-rate-limit.md`
3. ~~Aligner RLS `ai_request_logs`~~ → migration 025 appliquée
4. ~~Scoper storage `org-assets`~~ → migration 025 appliquée

### P1 — Court terme
5. ~~Compléter `.env.example`~~
6. ~~`fix/auth-rsc-session`~~ → **abandonner** (`docs/decisions/2026-07-15-abandon-fix-auth-rsc-session.md`)
7. ~~Documenter scripts ops~~ → `scripts/README.md` (versionner au prochain commit)
8. Templates WhatsApp Meta : attendre APPROVED + token permanent, puis `mark-meta-templates-approved`
9. ~~Formaliser bypass MVP `canWriteClients`~~ → `CRM_MVP_CLIENTS_BYPASS`
10. ~~Audit migrations~~ → FS-driven 001→025

### P2 — Moyen terme
11. UI invitation collaborateurs
12. Intégration paiement (Stripe) ou retirer variable env
13. Google Reviews API ou renommer module
14. Tests RLS integration pour tables 021–025
15. Sentry ou retirer variable env
16. Recherche globale ou retirer placeholder UI

---

*Généré par audit code du 2026-07-15. Mettre à jour ce fichier après changements majeurs.*
