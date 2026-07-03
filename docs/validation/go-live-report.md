# Rapport de validation Go-Live — Loyala AI

**Date :** _______________  
**Environnement :** ☐ Staging  ☐ Production  
**Validé par :** _______________

---

## 1. Services

| Service | URL | Statut | Notes |
|---------|-----|--------|-------|
| Loyala Web (Vercel) | | ☐ ✅ ☐ ❌ | Next.js — `/api/health` |
| backend-api (Railway) | `.../api/v1/health` | ✅ 200 | `db: connected` — 2026-07-03 |
| backend-api (Vercel) | nine-wine.vercel.app | ⚠️ | Crash reflect-metadata — ignorer |
| Supabase | | ☐ ✅ ☐ ❌ | |
| Inngest | | ☐ ✅ ☐ ❌ ☐ N/A | |

---

## 2. Migrations Supabase

| Migration | Appliquée | Vérifié |
|-----------|-----------|---------|
| `001_core_tenant.sql` | ☐ | ☐ |
| `002_crm_clients.sql` | ☐ | ☐ |
| `003_ai_logs.sql` | ☐ | ☐ |
| `004_client_date_of_birth.sql` | ☐ | ☐ |
| `005_ai_metrics_rpc.sql` | ☐ | ☐ |

Commande : `DATABASE_URL=... pnpm db:migrate`

---

## 3. Endpoints API

| Endpoint | HTTP | Attendu | Statut |
|----------|------|---------|--------|
| `GET /api/v1/health` (Railway backend-api) | 200 | `db: connected` | ✅ |
| `GET /api/health` (Vercel loyala web) | 200 | `status: ok` | ☐ |
| `GET /api/metrics/ai` (auth) | 200 | métriques JSON | ☐ |
| `POST /ai/inbox/classify` (worker + secret) | 200 | classification | ☐ |
| `GET/POST /api/inngest` | 200 | handler Inngest | ☐ |

---

## 4. Tests automatisés (baseline CI)

| Suite | Commande | Dernière exécution | Résultat |
|-------|----------|-------------------|----------|
| Typecheck | `pnpm typecheck` | 2026-07-02 | ✅ 9/9 packages |
| Unit + RLS static | `pnpm test` | 2026-07-02 | ✅ 27 passés, 3 skipped |
| RLS integration | `pnpm test:rls` | | ☐ Requiert secrets Supabase |

---

## 5. Parcours critiques (Sprint 2)

| # | Parcours | Testeur | Statut | Bug # |
|---|----------|---------|--------|-------|
| 1 | Création compte | | ☐ ✅ ☐ ❌ | |
| 2 | Création organisation | | ☐ ✅ ☐ ❌ | |
| 3 | Invitation collaborateur | | ☐ ✅ ☐ ❌ ☐ N/A | Non implémenté |
| 4 | Login / logout | | ☐ ✅ ☐ ❌ | |
| 5 | Création client | | ☐ ✅ ☐ ❌ | |
| 6 | Modification client | | ☐ ✅ ☐ ❌ | |
| 7 | Suppression client | | ☐ ✅ ☐ ❌ | |
| 8 | RBAC (viewer vs admin) | | ☐ ✅ ☐ ❌ | |
| 9 | Isolation inter-orgs | | ☐ ✅ ☐ ❌ | |

---

## 6. Logs — erreurs critiques

| Source | Période | Erreurs critiques | Statut |
|--------|---------|-------------------|--------|
| Vercel logs | 24 h | | ☐ Aucune ☐ Bloquantes |
| Railway logs | 24 h | | ☐ Aucune ☐ Bloquantes |
| Supabase logs | 24 h | | ☐ Aucune ☐ Bloquantes |

---

## 7. Performances

| Métrique | Seuil | Mesuré | Statut |
|----------|-------|--------|--------|
| `/api/health` latency | < 500 ms | | ☐ |
| Dashboard TTFB | < 2 s | | ☐ |
| CRM list clients | < 3 s | | ☐ |

---

## 8. Secrets configurés

| Variable | Vercel | Railway | Statut |
|----------|--------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_*` | ☐ | — | |
| `SUPABASE_SERVICE_ROLE_KEY` | ☐ | ☐ | |
| `OPENAI_API_KEY` | — | ☐ | |
| `ANTHROPIC_API_KEY` | — | ☐ | |
| `WORKER_API_SECRET` | ☐ | ☐ | |
| `INNGEST_*` | — | ☐ | |

---

## 9. Bugs découverts

| ID | Sévérité | Description | Statut |
|----|----------|-------------|--------|
| | P0 / P1 / P2 | | Ouvert / Corrigé |

---

## 10. Décision

| Gate | Statut |
|------|--------|
| **Sprint 1 — Go-Live technique** | ☐ Validé ☐ Bloqué |
| **Sprint 2 — Validation fonctionnelle** | ☐ Validé ☐ Bloqué |
| **Autorisation reprise dev Sprint 3** | ☐ Oui ☐ Non |

**Signature tech lead :** _______________  
**Signature product :** _______________

---

*Baseline automatisée mise à jour le 2026-07-02. Compléter les sections ☐ après déploiement prod/staging.*
