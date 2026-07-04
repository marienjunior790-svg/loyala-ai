# Audit production — Loyala AI

Objectif : valider que Loyala AI peut accueillir ses premiers utilisateurs sans risque critique.

**Règle :** aucune nouvelle fonctionnalité tant que les sections P0/P1 ne sont pas validées.

## Résumé des gates

| Gate | Statut requis |
|------|---------------|
| P0 — Bloquants Go-Live | 100 % validé |
| P1 — Sécurité / données / auth | 100 % validé |
| P2 — Observabilité / performance | >= 90 % validé |
| P3 — UX / opérations | >= 80 % validé |

---

## P0 — Bloquants Go-Live

- [ ] `GET https://backend-api-production-222b.up.railway.app/api/v1/health` retourne 200.
- [ ] `GET https://loyala-ai-web.vercel.app/api/health` retourne 200.
- [ ] Le healthcheck frontend indique `checks.supabase = ok`.
- [ ] Les variables Supabase Vercel sont correctes.
- [ ] Les variables Railway prod sont complètes.
- [ ] `AI_ALLOW_MOCK=false` en production.
- [ ] Les migrations Prisma sont toutes appliquées.
- [ ] Les migrations SQL Supabase attendues sont appliquées, si ce pipeline est utilisé.
- [ ] Aucun service critique ne retourne 500 pendant les smoke tests.
- [ ] Aucun secret réel n’est présent dans GitHub.

---

## Base de données / Supabase

- [ ] `_prisma_migrations` contient les 10 migrations attendues.
- [ ] Chaque migration a `finished_at` renseigné.
- [ ] Les tables attendues existent.
- [ ] Les tables multi-tenant ont une colonne tenant (`organization_id` ou équivalent).
- [ ] RLS est actif sur toutes les tables métier.
- [ ] Les policies RLS existent pour `organizations`.
- [ ] Les policies RLS existent pour `organization_members`.
- [ ] Les policies RLS existent pour `clients`.
- [ ] Les policies RLS existent pour `domain_events`.
- [ ] Les policies RLS existent pour `ai_request_logs`.
- [ ] Les index multi-tenant existent (`organization_id`, `created_at`).
- [ ] Les index CRM existent (`organization_id`, `phone`, `segment`).
- [ ] Les contraintes uniques critiques existent.
- [ ] Le test CRUD DB fonctionne.
- [ ] Le test cross-tenant bloque les accès entre organisations.
- [ ] `domain_events` reçoit un événement après création client.
- [ ] `ai_request_logs` reçoit un log après appel IA.
- [ ] Supabase Auth est activé.
- [ ] Redirect URLs Auth sont limitées aux domaines autorisés.
- [ ] Backup Supabase activé.

---

## Authentification

- [ ] Création compte fonctionne.
- [ ] Confirmation email fonctionne ou est volontairement désactivée.
- [ ] Connexion fonctionne.
- [ ] Déconnexion fonctionne.
- [ ] Reset password fonctionne.
- [ ] Session Supabase persistée correctement.
- [ ] Middleware redirige un utilisateur non connecté vers `/login`.
- [ ] Middleware redirige un utilisateur sans org vers `/onboarding`.
- [ ] Cookie org est `httpOnly`.
- [ ] Cookie org est `secure` en production.
- [ ] Aucun token n’est exposé dans les logs.
- [ ] Les routes privées ne sont pas accessibles sans session.

---

## Parcours métier

- [ ] Inscription complète.
- [ ] Connexion.
- [ ] Création organisation / restaurant.
- [ ] Accès dashboard après onboarding.
- [ ] Création client.
- [ ] Lecture client.
- [ ] Modification client.
- [ ] Suppression client (soft delete).
- [ ] Client supprimé absent de la liste.
- [ ] Données persistées après logout/login.
- [ ] Audit `client.created`.
- [ ] Audit `client.updated`.
- [ ] Audit `client.deleted`.
- [ ] Erreurs formulaire affichées proprement.
- [ ] Cas téléphone dupliqué géré.

---

## Permissions / RBAC / isolation

- [ ] Owner peut accéder aux settings.
- [ ] Owner peut CRUD clients.
- [ ] Admin peut CRUD clients selon policy prévue.
- [ ] Staff/viewer ne peut pas supprimer si non autorisé.
- [ ] Les server actions vérifient les permissions.
- [ ] Les routes API vérifient l’auth.
- [ ] Un utilisateur org A ne voit pas les clients org B.
- [ ] Un utilisateur org A ne peut pas modifier client org B.
- [ ] Un changement manuel de cookie org ne contourne pas RLS.
- [ ] Les erreurs d’accès retournent un statut propre.

---

## API / Backend Railway

- [ ] `/api/v1/health` retourne `db: connected`.
- [ ] Les routes auth répondent.
- [ ] Les routes organisations répondent.
- [ ] Les routes CRM répondent.
- [ ] Les erreurs Prisma sont loggées sans exposer de secrets.
- [ ] CORS autorise uniquement les domaines nécessaires.
- [ ] Les requêtes invalides retournent 400.
- [ ] Les requêtes non autorisées retournent 401/403.
- [ ] Aucun endpoint admin public non protégé.
- [ ] Les logs Railway restent sans 500 pendant les tests.

---

## Frontend Vercel

- [ ] `/api/health` retourne `status: ok`.
- [ ] `/login` charge.
- [ ] `/signup` charge.
- [ ] `/onboarding` charge après signup.
- [ ] `/dashboard` charge après session.
- [ ] `/clients` charge.
- [ ] Les env vars Vercel production sont définies.
- [ ] Build Vercel utilise le commit attendu.
- [ ] Pas d’erreur runtime dans Vercel logs.
- [ ] Les headers sécurité sont actifs.
- [ ] Le frontend appelle bien Railway quand nécessaire.

---

## Intégrations externes

- [ ] OpenAI key valide.
- [ ] Anthropic key valide.
- [ ] Fallback IA testé.
- [ ] Inngest endpoint configuré.
- [ ] Inngest signing key valide.
- [ ] Un job Inngest test réussit.
- [ ] WhatsApp marqué hors scope si non utilisé.
- [ ] Stripe/Paystack marqué hors scope si non utilisé.
- [ ] Les quotas externes sont connus.
- [ ] Les erreurs externes ont un fallback.

---

## Observabilité

- [ ] Uptime monitor web configuré.
- [ ] Uptime monitor backend configuré.
- [ ] Alerte email/Slack en cas de downtime.
- [ ] Logs Railway consultables.
- [ ] Logs Vercel consultables.
- [ ] Logs Supabase consultables.
- [ ] Erreurs critiques absentes sur 24 h.
- [ ] Erreurs critiques absentes sur 48 h.
- [ ] Coûts IA monitorés.
- [ ] Métriques API disponibles.
- [ ] Latence healthcheck suivie.
- [ ] CPU/RAM Railway suivis.

---

## Sécurité production

- [ ] HTTPS partout.
- [ ] HSTS actif.
- [ ] `X-Frame-Options` actif.
- [ ] `X-Content-Type-Options` actif.
- [ ] Rate limiting configuré ou explicitement reporté.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` jamais exposée côté client.
- [ ] Secrets Vercel séparés prod/preview.
- [ ] Secrets Railway séparés prod/dev.
- [ ] Rotation secrets planifiée.
- [ ] GitHub branch protection activée.
- [ ] CI obligatoire avant merge sur `main`.
- [ ] Dépendances installées via lockfile synchronisé.

---

## Performance

- [ ] Dashboard TTFB acceptable.
- [ ] Liste clients charge en moins de 3 secondes.
- [ ] Healthcheck web < 500 ms.
- [ ] Healthcheck backend < 500 ms.
- [ ] Pas de full scan évident sur tables tenant.
- [ ] Index utilisés sur requêtes CRM principales.
- [ ] Assets Next.js optimisés.
- [ ] Pas de bundle client inutilement lourd.
- [ ] Worker Railway CPU < 80 % en observation.
- [ ] Worker Railway mémoire stable.

---

## Backups / rollback

- [ ] Backup Supabase créé avant Go-Live.
- [ ] Restore testé sur staging ou documenté.
- [ ] Tag Git `v1.0.0-go-live` créé.
- [ ] Commit déployé Vercel documenté.
- [ ] Commit déployé Railway documenté.
- [ ] Rollback Vercel possible.
- [ ] Rollback Railway possible.
- [ ] Rollback DB documenté.
- [ ] Procédure incident documentée.
- [ ] Contact responsable incident défini.

---

## Décision

| Décision | Statut |
|----------|--------|
| Go-Live Sprint 1 | ☐ Autorisé ☐ Bloqué |
| Sprint 2 | ☐ Autorisé ☐ Bloqué |

**Bloqueur actuel connu :** `loyala-ai-web.vercel.app/api/health` retourne `503 degraded`, `checks.supabase = error`.
