export {
  eventEnvelopeSchema,
  DOMAIN_EVENT_TYPES,
  P0_EVENT_TYPES,
  isKnownDomainEventType,
  createEventEnvelope,
  type EventEnvelope,
  type DomainEventType,
  type P0EventType,
} from './catalog.js';

export {
  recordDomainEvent,
  type RecordDomainEventParams,
  type RecordDomainEventResult,
} from './record.js';
