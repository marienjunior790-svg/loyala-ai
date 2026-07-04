# Go-Live Sprint 1 — Ordre d'exécution officiel

**Règle :** gel des features jusqu'à signature complète.  
**Ensuite seulement :** Sprint 2 (voir § backlog).

**Rapport à signer :** [`go-live-report.md`](./go-live-report.md)

---

## §1 Valider la base de données

| # | Check | Comment | Statut |
|---|-------|---------|--------|
| 1.1 | **10 migrations Prisma** | `_prisma_migrations` — 10 lignes `finished_at` OK | ☐ |
| 1.2 | Tables attendues | SQL Editor ou script ci-dessous | ☐ |
| 1.3 | RLS actif | Toutes tables métier `rls_enabled = true` | ☐ |
| 1.4 | Premier utilisateur test | Signup prod → visible dans `auth.users` | ☐ |

**Script :** [`scripts/verify-supabase-go-live.sql`](../../scripts/verify-supabase-go-live.sql)

**Tables minimum (Loyala web) :**

`organizations` · `organization_members` · `roles` · `clients` · `domain_events` · `ai_request_logs`

> **Note :** `backend-api` (Prisma) et `loyala-ai` (SQL `supabase/migrations/`) peuvent coexister — vérifier les deux trackers si les deux pipelines sont utilisés.

---

## §2 Tester les endpoints production

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 2.1 | `GET /api/v1/health` (Railway `backend-api`) | **200**, `db: connected` | ✅ |
| 2.2 | `GET /api/health` (Vercel **loyala web**) | **200** JSON `status: ok` | ⚠️ `503`, `checks.supabase = error` |
| 2.3 | Authentification | Login / JWT Supabase | ☐ |
| 2.4 | Création organisation | API ou onboarding web | ☐ |
| 2.5 | CRUD CRM | Create / Read / Update / Delete client | ☐ |
| 2.6 | Upload document | ☐ N/A Loyala web | ⚠️ **Non implémenté** — backend-api si exposé |
| 2.7 | Logs Railway | Aucune erreur 5xx pendant tests | ☐ |

**Smoke curl :**
```bash
# Backend Railway (backend-api — Prisma health + DB ping)
curl -s https://backend-api-production-222b.up.railway.app/api/v1/health

# Frontend Loyala (Next.js sur Vercel — projet web, pas backend-api Express)
curl -s https://loyala-ai-web.vercel.app/api/health
```

Résultat actuel : frontend déployé, mais healthcheck `503 degraded` car le ping Supabase échoue. Vérifier `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans Vercel, puis redeployer.

> ⚠️ `backend-api-nine-wine.vercel.app` (Express) ≠ backend prod. Prod API = **Railway**.  
> Crash Vercel Express (`reflect-metadata` / tsyringe) = problème préexistant, non bloquant si Railway est la cible.

---

## §3 Workflow complet (bout en bout)

| # | Étape | Terme produit | Statut |
|---|-------|---------------|--------|
| 3.1 | Inscription | `/signup` | ☐ |
| 3.2 | Connexion | `/login` | ☐ |
| 3.3 | Création restaurant | = **organisation** `/onboarding` | ☐ |
| 3.4 | Ajout client | `/clients/new` | ☐ |
| 3.5 | Modification client | `/clients/[id]/edit` | ☐ |
| 3.6 | Suppression client | soft delete | ☐ |
| 3.7 | Audit / événements | ligne dans `domain_events` après CRUD | ☐ |

**Vérifier audit après création client :**
```sql
SELECT * FROM domain_events
WHERE event_type LIKE 'client.%'
ORDER BY created_at DESC LIMIT 5;
```

---

## §4 Valider les services externes

| Service | Config ☐ | Test ☐ | Notes |
|---------|----------|--------|-------|
| Supabase | ☐ | ☐ | URL + anon + service role |
| Railway | ☐ | ☐ | ACTIVE, logs clean |
| Vercel | ☐ | ☐ | Deploy main OK |
| OpenAI | ☐ | ☐ | `AI_ALLOW_MOCK=false` |
| Anthropic | ☐ | ☐ | Fallback |
| Inngest | ☐ | ☐ | `/api/inngest` + dashboard |

Checklist variables : [`.env.example`](../../.env.example)

---

## §5 Sauvegarde & rollback

| # | Action | Statut |
|---|--------|--------|
| 5.1 | Export backup Supabase (Dashboard → Backups) | ☐ |
| 5.2 | Tag Git `v1.0.0-go-live` sur commit stable | ☐ |
| 5.3 | Rollback Vercel testé (promote previous deploy) | ☐ |
| 5.4 | Rollback Railway testé (previous deployment) | ☐ |

```bash
git tag -a v1.0.0-go-live -m "Go-Live Sprint 1 validated"
git push origin v1.0.0-go-live
```

Voir aussi : [`rollback-strategy.md`](../runbooks/rollback-strategy.md)

---

## Gate Sprint 1

- ☐ §1 à §5 complets
- ☐ [`go-live-report.md`](./go-live-report.md) signé
- ☐ [`production-audit-checklist.md`](./production-audit-checklist.md) P0/P1 validés
- ☐ Aucun bug P0 ouvert

**Sign-off :** _______________ **Date :** _______________

---

## Sprint 2 — Ordre de développement (après gate)

Ne commencer **qu'après** signature Sprint 1 :

| Priorité | Module |
|----------|--------|
| 1 | Invitations collaborateurs |
| 2 | RBAC + ABAC complet |
| 3 | WhatsApp |
| 4 | IA Inbox |
| 5 | Avis Google |
| 6 | Campagnes |
| 7 | Paiements (Stripe/Paystack) |
| 8 | Marketplace |

---

## Baseline CI (local)

| Suite | Résultat |
|-------|----------|
| `pnpm typecheck` | ✅ 9/9 |
| `pnpm test` | ✅ 27 passés |

## Bloqueurs connus

| Item | Impact |
|------|--------|
| `GET /api/health` Vercel | §2.2 — actuellement `503 degraded`, `checks.supabase = error` |
| Upload document | §2.6 — hors scope Loyala web actuel |
| Invitations | Sprint 2 #1 |
