# Domain events (P3)

## Catalogue

Types connus : `packages/events/src/catalog.ts` (`DOMAIN_EVENT_TYPES`).

## Persistance

`recordDomainEvent()` (`packages/events/src/record.ts`) écrit dans Supabase `domain_events`.

- Non-bloquant pour l’UX (erreurs loguées, pas throw)
- Colonne `event_id` (migration `026_domain_events_hardening.sql`) pour idempotence
- Fallback sans `event_id` si la colonne n’est pas encore appliquée

## Émetteurs

| Site | Events |
|------|--------|
| Web CRM actions | `client.*`, visits, expenses |
| Web campaigns | `campaign.created`, `campaign.scheduled`, `campaign.send.requested` |
| Worker WhatsApp webhook | `message.received` |

## Bridge Inngest

Après un insert réussi côté worker (ex. message inbound), `emitDomainEventBridge` envoie `loyala/domain.event`.

Consumer : `domainEventConsumer` (`apps/worker/src/inngest/functions.ts`) — ack / futur fan-out.

## Activity feed

Labels dashboard : `apps/web/lib/dashboard/activity.ts`.
