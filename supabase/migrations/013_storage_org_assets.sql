-- Loyala AI — Migration 013: Supabase Storage for org assets (logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY org_assets_read ON storage.objects
  FOR SELECT USING (bucket_id = 'org-assets');

CREATE POLICY org_assets_write ON storage.objects
  FOR ALL USING (
    bucket_id = 'org-assets'
    AND auth.role() = 'authenticated'
  );
