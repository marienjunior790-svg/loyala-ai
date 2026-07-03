-- Loyala AI — Migration 004: client date_of_birth (birthday campaigns)

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE INDEX IF NOT EXISTS idx_clients_org_birthday
  ON clients(organization_id, date_of_birth)
  WHERE date_of_birth IS NOT NULL AND deleted_at IS NULL;
