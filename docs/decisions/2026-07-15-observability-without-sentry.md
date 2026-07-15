# Observabilité sans Sentry (P3)

**Date:** 2026-07-15  
**Statut:** Accepté

## Contexte

`SENTRY_DSN` figurait dans le schéma Zod et la doc d’observabilité, mais aucun SDK `@sentry/*` n’était installé ni initialisé. Cela créait une fausse attente opérationnelle.

## Décision

Ne **pas** intégrer Sentry pour le MVP. L’observabilité erreurs repose sur :

1. Logs structurés JSON (`logStructured` / `reportError` dans `apps/web/lib/monitoring/error-report.ts`)
2. Health checks web + worker
3. Heartbeat Better Stack optionnel (`BETTERSTACK_HEARTBEAT_URL`)
4. Audit métier via `domain_events`

## Conséquences

- `SENTRY_DSN` retiré de `packages/validation`
- Runbook observabilité mis à jour (Sentry = option future, pas un prérequis)
- Réintroduire `@sentry/nextjs` + `@sentry/node` uniquement quand un DSN prod et un budget d’événements sont validés
