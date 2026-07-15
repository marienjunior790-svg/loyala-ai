-- Loyala AI — Migration 025: P0 security fixes
-- 1. ai_request_logs RLS → public.user_org_ids() (was auth.user_org_ids())
-- 2. storage org-assets → isolate read/write/delete by organization folder

-- ─── ai_request_logs RLS ───────────────────────────────────────────────────

DROP POLICY IF EXISTS ai_logs_select ON ai_request_logs;
CREATE POLICY ai_logs_select ON ai_request_logs
  FOR SELECT USING (
    organization_id IN (SELECT public.user_org_ids())
  );

-- ─── storage org-assets isolation ──────────────────────────────────────────
-- Object path convention: {organization_id}/logo.{ext}

DROP POLICY IF EXISTS org_assets_read ON storage.objects;
DROP POLICY IF EXISTS org_assets_write ON storage.objects;
DROP POLICY IF EXISTS org_assets_insert ON storage.objects;
DROP POLICY IF EXISTS org_assets_update ON storage.objects;
DROP POLICY IF EXISTS org_assets_delete ON storage.objects;

CREATE POLICY org_assets_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'org-assets'
    AND (
      auth.role() = 'service_role'
      OR (storage.foldername(name))[1]::uuid IN (SELECT public.user_org_ids())
    )
  );

CREATE POLICY org_assets_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'org-assets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_org_ids())
  );

CREATE POLICY org_assets_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'org-assets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_org_ids())
  );

CREATE POLICY org_assets_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'org-assets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_org_ids())
  );

-- ─── Tracker ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _loyala_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _loyala_migrations (name) VALUES ('025_p0_security_fixes.sql')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
