# Scripts d'exploitation — Loyala AI

Catalogue des scripts `scripts/`. Secrets via `.env.ops.local` (jamais committer) —
voir `docs/runbooks/env.ops.local.example`.

## Canoniques (package.json)

| Commande | Script | Rôle |
|----------|--------|------|
| `pnpm db:migrate` | `apply-migrations.mjs` | Applique toutes les migrations + tracker |
| `pnpm db:audit` | `audit-supabase-migrations.mjs` | Audit tables/RLS/RPC/migrations 001→N |
| — | `backfill-migration-tracker.mjs` | Remplit `_loyala_migrations` pour 021–025 si tables existent |
| `pnpm db:apply-019` … `024` | `apply-migration-file.mjs` | Migration ciblée |
| `pnpm db:apply-phase1-whatsapp` | `apply-phase1-whatsapp-migrations.mjs` | 022–024 |
| `pnpm db:verify-022` … `024` | `verify-02x-*.mjs` | Vérifs post-migration |
| `pnpm whatsapp:submit-templates` | `submit-meta-whatsapp-templates.mjs` | Soumission Meta |
| `pnpm whatsapp:approve-templates` | `mark-meta-templates-approved.mjs` | Mark DB approved |
| `pnpm verify:prod` | `verify-production.mjs` | Smoke prod |
| `pnpm ops:phase1` | `run-phase1-ops.mjs` | Runner ops Phase 1 |

## Sécurité / P0–P1

| Script | Rôle |
|--------|------|
| `verify-025-p0-security.mjs` | Policies ai_request_logs + org-assets |
| `verify-upstash-rate-limit.mjs` | Probe Redis Upstash |
| `check-meta-template-status.mjs` | Statut templates Meta + DB |
| `check-meta-production-readiness.mjs` | WABA / phone / token |
| `whatsapp-pilot-send.mjs` | Envoi pilote `/whatsapp/send-test` |
| `list-db-templates.mjs` | Catalogue DB templates |
| `apply-org-hotfix.mjs` | Hotfix colonnes `organizations` |

## Migrations & schéma

| Script | Notes |
|--------|------|
| `apply-migration-file.mjs` | Charge `.env.ops.local` ; chunks `-- ───` |
| `audit-prod-schema.mjs` | Schéma prod |
| `probe-*-schema.mjs` | Probes ciblés |
| `sql/*.sql` | Hotfixes SQL manuels |

## Railway / Inngest

| Script | Rôle |
|--------|------|
| `sync-railway-*.mjs` | Sync env Railway |
| `audit-inngest-keys.mjs` | Audit clés |
| `diagnose-inngest.mjs` | Diagnostic |
| `probe-inngest-*.mjs` | Probes endpoint |

## Hostinger (export alternatif — non prod actuelle)

Scripts `hostinger-*`, `*-zip-*`, `export-hostinger-zip.ps1` : pipeline d'export local.
Documenté dans `HOSTINGER_DEPLOY.md`. **Ne pas utiliser** comme déploiement principal
(`fmagence.online` = Vercel `loyala-ai-web`).

## Conventions

1. Ne jamais logger secrets / tokens / numéros complets.
2. Préférer lire `.env.ops.local` plutôt que d'exiger l'export shell.
3. Sortie machine-readable (JSON) quand le script sert de CI/gate.
4. Un script one-shot de debug peut rester local ; documenter ici s'il devient récurrent.

## Branche `fix/auth-rsc-session`

**Décision P1 : abandonner** (déjà intégrée dans `main` via commit `0d9264d`).
Aucun diff unique vs `main`. Supprimer localement/remotement quand pratique :

```bash
git branch -d fix/auth-rsc-session
git push origin --delete fix/auth-rsc-session
```
