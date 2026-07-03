# ADR-001: Monorepo Turborepo

**Statut:** Accepté  
**Date:** 2025-06

## Contexte
Loyala AI nécessite apps multiples (web, worker, admin) et packages partagés (IAM, AI, events).

## Décision
Monorepo avec Turborepo + pnpm workspaces.

## Conséquences
- Builds incrémentaux, cache partagé
- Refactoring cross-packages simplifié
- CI unifiée
