# Gouvernance Blueprint

## Statut officiel

| Version | Statut | Périmètre |
|---------|--------|-----------|
| v2.0 | **APPROUVÉ** | Vision, plateforme, IA, permissions, events, API, marketplace, multi-produit |
| v2.1 | **APPROUVÉ** | Business, finance, data, DR, qualité, écosystème, principes immuables |

> Blueprint v2.0 approuvé comme fondation stratégique de Loyala AI.  
> v2.1 intègre la couche entreprise. Ce corpus est la référence unique.

## Sprint 0 — Autorisé

**Durée :** 2 semaines  
**Principe :** aucun développement hors Blueprint.

### Livrables Sprint 0

- [x] Monorepo Turborepo
- [x] `packages/core-iam` — auth, tenant, RBAC base
- [x] `packages/db` — migrations v1 + RLS
- [x] `packages/core-ai` — orchestrator skeleton
- [x] `packages/events` — enveloppe + 5 events P0
- [x] `apps/web` — layout, auth, onboarding shell
- [x] CI quality gates
- [x] ADR-001 à ADR-008
- [x] Runbook DR skeleton
- [x] `packages/ui` — design tokens + Button primitive
- [x] `apps/worker` — health skeleton
## Sprint 1 — Livré

**Objectifs :** auth Supabase, middleware tenant, onboarding org, tests RLS CI, CRM clients.

### Livrables Sprint 1

- [x] Auth : login, signup, logout, récupération mot de passe (`/forgot-password`, `/reset-password`, `/auth/callback`)
- [x] Middleware multi-tenant (`loyala_org_id`, isolation par organisation)
- [x] Onboarding : création org, premier admin `org_owner`, config pays/fuseau/devise
- [x] Événements `organization.created` + `member.joined` (audit `domain_events`)
- [x] Tests RLS statiques + intégration cross-tenant (CI bloquante si secrets configurés)
- [x] CRM Clients : CRUD complet, validation Zod, RBAC, audit (`client.created|updated|deleted`)

### Definition of Done

- Conforme checklist feature (Annexe dans 10-immutable-principles.md)
- Tests cross-tenant verts
- CI quality gates verts
- ADR pour décisions non triviales
- Review pair obligatoire
- README par package

## Gate feature (avant chaque sprint)

| Question | Référence |
|----------|-----------|
| Module cœur ou métier identifié ? | 01-vision-platform.md |
| Permissions RBAC + ABAC ? | 02-ia-permissions-events.md |
| Domain events documentés ? | 02-ia-permissions-events.md |
| Impact économique évalué ? | 05-financial-architecture.md |
| Conforme principes immuables ? | 10-immutable-principles.md |
