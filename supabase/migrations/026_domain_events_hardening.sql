-- Loyala AI — Migration 026: domain_events hardening (P3)
-- event_id for idempotency + restore aggregate index

ALTER TABLE domain_events
  ADD COLUMN IF NOT EXISTS event_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_events_event_id
  ON domain_events(event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate
  ON domain_events(aggregate_type, aggregate_id);

CREATE TABLE IF NOT EXISTS _loyala_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _loyala_migrations (name) VALUES ('026_domain_events_hardening.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
