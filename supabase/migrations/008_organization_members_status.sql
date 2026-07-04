-- Loyala AI — Migration 008: align organization_members.status (Prisma ↔ Loyala web)
-- Production backend-api schema may omit status; middleware and RLS require it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE organization_members
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('pending', 'active', 'suspended'));
  END IF;
END $$;

UPDATE organization_members SET status = 'active' WHERE status IS NULL;

CREATE OR REPLACE FUNCTION auth.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;
