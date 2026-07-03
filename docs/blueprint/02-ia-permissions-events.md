# IA, Permissions & Events

## AI Platform

Point d'entrée unique : `ai.orchestrate()`. Composants : Orchestrator, Prompt Engine, Memory Store, Cost Controller, Model Registry, Guardrails, Evaluation Engine.

**Règle :** aucun module métier n'appelle un provider IA directement.

## RBAC + ABAC

1. RBAC : rôle autorise permission
2. ABAC : politiques attributs (plan, quotas, horaires, location)

### Rôles organisation

`org_owner` (100) → `org_admin` (80) → `org_manager` (60) → `org_staff` (40) → `org_viewer` (20)

### Permissions clés

`clients:*`, `campaigns:send`, `inbox:reply`, `ai:auto_reply:enable`, `reviews:publish`, `org:billing:manage`, `team:invite`

## Domain Event Catalog (P0)

### Platform
`organization.created`, `member.joined`, `subscription.updated`, `usage.limit_exceeded`

### CRM
`client.created`, `client.segment.changed`, `client.visit.recorded`, `client.opt_out.changed`

### Engagement
`campaign.send.requested`, `campaign.send.completed`, `campaign.delivery.sent`

### Inbox
`message.received`, `message.sent`

### AI
`ai.request.completed`, `ai.budget.exceeded`, `ai.response.approved`

### Réputation
`review.synced`, `review.response.published`

**Enveloppe :** `{ eventId, eventType, version, occurredAt, organizationId, payload }`

Voir implémentation : `packages/events/src/catalog.ts`
