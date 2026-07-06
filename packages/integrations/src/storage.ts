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
