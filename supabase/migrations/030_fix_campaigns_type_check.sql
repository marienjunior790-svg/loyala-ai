-- Loyala AI — Migration 030
-- Fix stale campaigns_type_check constraint.
--
-- Production shipped an early campaigns table whose type CHECK allowed
-- ('email','sms','social','ads','other'). Later migrations (012/016/017) used
-- CREATE TABLE IF NOT EXISTS and only refreshed the *status* constraint, so the
-- legacy *type* constraint survived and rejects CRM inserts ('birthday',
-- 'inactive', 'loyalty', 'promotion', 'manual').
--
-- This migration drops whatever type CHECK exists and re-adds the correct one.

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
      AND rel.relname = 'campaigns'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE campaigns DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_type_check
    CHECK (type IN ('birthday', 'inactive', 'loyalty', 'promotion', 'manual'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'campaigns type check fix skipped: %', SQLERRM;
END $$;
