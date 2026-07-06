'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { hasPermission } from '@loyala/core-iam';
import { createClient } from '@/lib/supabase/server';
import { updateOrganization } from '@loyala/domain-crm';
import { uploadOrgLogo } from '@loyala/integrations';

export type SettingsActionState = { error?: string; success?: string };

export async function updateOrganizationSettingsAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'org:settings') && ctx.role !== 'org_owner' && ctx.role !== 'org_admin') {
    return { error: 'Permission refusée' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const whatsappPhone = String(formData.get('whatsappPhone') ?? '').trim();
  const logoFile = formData.get('logo') as File | null;

  if (name.length < 2) return { error: 'Nom requis' };

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', ctx.organizationId)
    .single();

  const settings: Record<string, unknown> = {
    ...(org?.settings as Record<string, unknown> ?? {}),
    whatsapp_phone: whatsappPhone,
  };

  if (logoFile && logoFile.size > 0) {
    try {
      const logoUrl = await uploadOrgLogo(supabase, ctx.organizationId, logoFile);
      settings.logo_url = logoUrl;
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erreur upload logo' };
    }
  }

  try {
    await updateOrganization(supabase, ctx.organizationId, { name, settings });
    revalidatePath('/settings');
    revalidatePath('/administration');
    return { success: 'Paramètres enregistrés' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur sauvegarde' };
  }
}
