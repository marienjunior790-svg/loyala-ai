'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { hasPermission } from '@loyala/core-iam';
import { createClient } from '@/lib/supabase/server';
import {
  disconnectWhatsAppConnection,
  getWhatsAppConnectionPublic,
  type WhatsAppConnectionPublic,
} from '@loyala/domain-crm';
import {
  testWhatsAppConnectionForOrganization,
  upsertWhatsAppConnectionForOrganization,
} from '@loyala/domain-crm/whatsapp-secure';

export type WhatsAppSettingsState = {
  error?: string;
  success?: string;
  connection?: WhatsAppConnectionPublic;
};

function assertCanManageWhatsApp(
  ctx: Awaited<ReturnType<typeof requireAuth>>
): WhatsAppSettingsState | null {
  if (!hasPermission(ctx, 'org:settings') && ctx.role !== 'org_owner' && ctx.role !== 'org_admin') {
    return { error: 'Permission refusée — seuls owner/admin gèrent WhatsApp Business' };
  }
  return null;
}

/** Organization is always taken from the authenticated session — never from the form. */
export async function connectWhatsAppBusinessAction(
  _prev: WhatsAppSettingsState,
  formData: FormData
): Promise<WhatsAppSettingsState> {
  try {
    const ctx = await requireAuth();
    const denied = assertCanManageWhatsApp(ctx);
    if (denied) return denied;

    const supabase = await createClient();
    const connection = await upsertWhatsAppConnectionForOrganization(supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      displayPhone: String(formData.get('displayPhone') ?? ''),
      phoneNumberId: String(formData.get('phoneNumberId') ?? ''),
      wabaId: String(formData.get('wabaId') ?? ''),
      accountName: String(formData.get('accountName') ?? '') || undefined,
      accessToken: String(formData.get('accessToken') ?? ''),
    });

    revalidatePath('/settings');
    revalidatePath('/clients');
    return { success: 'WhatsApp Business connecté', connection };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur connexion WhatsApp' };
  }
}

export async function disconnectWhatsAppBusinessAction(): Promise<WhatsAppSettingsState> {
  try {
    const ctx = await requireAuth();
    const denied = assertCanManageWhatsApp(ctx);
    if (denied) return denied;

    const supabase = await createClient();
    await disconnectWhatsAppConnection(supabase, ctx.organizationId);
    revalidatePath('/settings');
    revalidatePath('/clients');
    return {
      success: 'WhatsApp déconnecté',
      connection: await getWhatsAppConnectionPublic(supabase, ctx.organizationId),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur déconnexion' };
  }
}

export async function testWhatsAppBusinessAction(): Promise<WhatsAppSettingsState> {
  try {
    const ctx = await requireAuth();
    const denied = assertCanManageWhatsApp(ctx);
    if (denied) return denied;

    const supabase = await createClient();
    const result = await testWhatsAppConnectionForOrganization(supabase, ctx.organizationId);
    const connection = await getWhatsAppConnectionPublic(supabase, ctx.organizationId);
    revalidatePath('/settings');
    return result.ok
      ? { success: result.message, connection }
      : { error: result.message, connection };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur test' };
  }
}

export async function getWhatsAppConnectionAction(): Promise<WhatsAppConnectionPublic> {
  const ctx = await requireAuth();
  const supabase = await createClient();
  return getWhatsAppConnectionPublic(supabase, ctx.organizationId);
}
