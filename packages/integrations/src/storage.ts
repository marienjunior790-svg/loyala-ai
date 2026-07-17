import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'org-assets';

export async function uploadOrgLogo(
  supabase: SupabaseClient,
  organizationId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${organizationId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload a catalog product image (already optimized bytes) to org-scoped storage.
 * Returns a stable public URL. Reuses the shared `org-assets` bucket.
 */
export async function uploadCatalogImage(
  supabase: SupabaseClient,
  organizationId: string,
  bytes: Uint8Array | ArrayBuffer,
  options?: { contentType?: string; ext?: string }
): Promise<string> {
  const ext = options?.ext ?? 'webp';
  const contentType = options?.contentType ?? 'image/webp';
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${organizationId}/catalog/${id}.${ext}`;

  const body = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
