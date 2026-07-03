# Checklist production — Loyala AI

Cocher chaque item avant ouverture aux clients payants.

## 1. Infrastructure

- [ ] Projet Supabase créé (prod, distinct de staging)
- [ ] Migrations 001→005 appliquées (`pnpm db:migrate`)
- [ ] RLS vérifié (`pnpm test` + `pnpm test:rls` avec secrets CI)
- [ ] Backups Supabase activés (Plan Pro+ : PITR recommandé)
- [ ] Vercel projet web connecté au repo `main`
- [ ] Worker déployé (Railway/Fly) avec domaine HTTPS
- [ ] Inngest configuré → URL worker `/api/inngest`
- [ ] Upstash Redis créé (rate limiting prod)

## 2. Secrets & variables

- [ ] Toutes les variables `.env.example` renseignées en **Production**
- [ ] Aucun secret dans Git (scan `.env*` dans `.gitignore`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` uniquement Vercel server + Worker
- [ ] `WORKER_API_SECRET` généré (32+ chars aléatoires)
- [ ] `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` actifs
- [ ] `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` prod
- [ ] `AI_ALLOW_MOCK=false` en production
- [ ] Preview/staging : secrets séparés de prod

## 3. Sécurité

- [ ] HTTPS forcé (Vercel auto)
- [ ] Headers sécurité actifs (`vercel.json`)
- [ ] Rate limiting API testé (429 après seuil)
- [ ] Routes worker `/ai/*` protégées par `WORKER_API_SECRET`
- [ ] Auth email confirmée / SMTP configuré Supabase
- [ ] Redirect URLs auth limitées aux domaines prod
- [ ] CORS : pas d'API publique non authentifiée (sauf `/api/health`)

## 4. Fonctionnel

- [ ] Signup → onboarding → dashboard
- [ ] CRUD clients CRM
- [ ] Isolation tenant (user A ne voit pas org B)
- [ ] Dashboard charge métriques IA (`/api/metrics/ai`)
- [ ] Worker `/health` → `status: ok`
- [ ] Web `/api/health` → `status: ok`
- [ ] Log IA visible dans `ai_request_logs` après appel test
- [ ] Job Inngest test manuel (anniversaire ou inactif)

## 5. CI/CD

- [ ] GitHub Actions CI verte sur `main`
- [ ] Build Vercel réussi
- [ ] Build worker réussi
- [ ] Secrets GitHub Actions configurés (Supabase pour RLS CI)
- [ ] Branch protection sur `main` (PR + CI required)

## 6. Monitoring & alertes

- [ ] Sentry (ou équivalent) connecté web + worker
- [ ] Uptime monitor sur `https://[app]/api/health`
- [ ] Uptime monitor sur `https://[worker]/health`
- [ ] Alerte email/Slack si health down > 2 min
- [ ] Alerte coût IA si `cost_usd` daily > seuil (requête Supabase)
- [ ] Dashboard Inngest sans failed functions récurrentes

## 7. Logs centralisés

- [ ] Logs Vercel activés (retention selon plan)
- [ ] Logs Railway/Fly worker exportés
- [ ] `ai_request_logs` + `domain_events` queryables
- [ ] Corrélation via `request_id` dans logs IA

## 8. Performance

- [ ] Lighthouse dashboard > 80 (mobile)
- [ ] Connection pooler Supabase (port 6543) si > 100 connexions
- [ ] Images Next.js optimisées
- [ ] Cache IA TTL configuré (`AI_CACHE_TTL_SECONDS=3600`)
- [ ] Région Vercel proche utilisateurs cibles

## 9. Backups & DR

- [ ] Backup Supabase daily vérifié
- [ ] Procédure restore documentée (testée sur staging)
- [ ] Export schema migrations versionné (`supabase/migrations/`)
- [ ] Rollback Vercel documenté (voir `rollback-strategy.md`)

## 10. Légal & ops

- [ ] Politique confidentialité / CGU publiées
- [ ] Contact support défini
- [ ] Runbook incident accessible à l'équipe
- [ ] Rotation clés planifiée (calendrier trimestriel)

---

**Sign-off**

| Rôle | Nom | Date |
|------|-----|------|
| Tech lead | | |
| DevOps | | |
| Product | | |
