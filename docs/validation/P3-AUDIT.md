# Audit P3 — Maintenabilité (2026-07-15)

## Objectif

Réduire la dette technique (architecture, builds, lint, observabilité, UI) sans régression fonctionnelle.

## Livrables

| Item | Statut | Notes |
|------|--------|-------|
| Système `domain_events` | ✅ | Catalogue étendu, `recordDomainEvent` partagé, migration `026`, bridge Inngest + consumer |
| Turborepo / builds | ✅ | Worker `build` = bundle ; lint sans `^build` ; doc packages source |
| ESLint complet | ✅ | Flat config racine ; placeholders `echo` remplacés |
| Sentry | ✅ | Purge config inutilisée ; logs structurés officiels (décision) |
| Bibliothèque UI | ✅ | Auth → `@/components/ui/button` ; `@loyala/ui` = tokens + `cn` |
| Tests | ✅ | Catalog/record events, bridge Inngest, env validation |
| Documentation | ✅ | `domain-events.md`, `monorepo-packages.md`, décision Sentry, runbooks |

## Vérifications

- Unit tests : **143 passed** (3 skipped), suite complète
- ESLint `apps` + `packages` : **0 errors** (warnings tolérés)
- Lint racine : `eslint apps packages` (évite la dépendance Turbo → binaire `pnpm` local)
- Pas de SDK Sentry ajouté (volontaire)
- Auth forms n’importent plus `@loyala/ui` Button

## Dette restante (hors P3)

- Appliquer migration `026` en prod (`pnpm db:apply-026`)
- Sync Inngest pour enregistrer `loyala-domain-event-consumer`
- Warnings ESLint historiques dans `apps/web` (seuil `max-warnings=200`) — réduire progressivement
- Packages source : pas de `dist` publié (acceptable pour monorepo interne)

## Verdict

La dette technique P3 ciblée est **réduite** ; le projet reste stable sur le périmètre testé. Aucune fonctionnalité métier volontairement retirée.
