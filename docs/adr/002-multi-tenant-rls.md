# ADR-002: Multi-tenant RLS Shared Schema

**Statut:** Accepté

## Décision
Shared database, shared schema, isolation via `organization_id` + PostgreSQL RLS.

## Inviolable (T1)
Tests cross-tenant obligatoires en CI.
