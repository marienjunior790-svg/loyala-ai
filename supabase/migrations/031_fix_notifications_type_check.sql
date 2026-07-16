-- Loyala AI — Migration 031
-- Fix stale notifications_type_check constraint.
--
-- Production shipped a generic notifications type CHECK allowing only
-- ('info','success','warning','error'). The CRM inserts domain notification
-- types ('campaign','client','review','loyalty','billing'), which the legacy
-- constraint rejects — breaking campaign generation (persistCampaignPlans
-- creates a 'campaign' notification after saving relances).
--
-- Re-add a superset covering both domain and generic values so existing rows
-- and all code paths pass.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'notifications'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'info', 'campaign', 'client', 'loyalty', 'review', 'billing',
      'success', 'warning', 'error', 'system'
    ));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'notifications type check fix skipped: %', SQLERRM;
END $$;
