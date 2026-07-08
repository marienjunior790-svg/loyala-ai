'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  CAMPAIGN_TYPES,
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  scheduleCampaign,
  setCampaignStatus,
  updateCampaign,
  type CampaignStatus,
  type CampaignType,
} from '@loyala/domain-crm';

export type CampaignCrudState = { error?: string; success?: string };

const WRITE_PERMISSION = 'clients:write' as const;

function revalidateCampaigns() {
  revalidatePath('/campaigns');
  revalidatePath('/relances');
  revalidatePath('/notifications');
}

function parseType(raw: FormDataEntryValue | null): CampaignType | null {
  const value = String(raw ?? '').trim();
  return (CAMPAIGN_TYPES as readonly string[]).includes(value)
    ? (value as CampaignType)
    : null;
}

export async function createCampaignAction(
  _prev: CampaignCrudState,
  formData: FormData
): Promise<CampaignCrudState> {
  try {
    const ctx = await requireAuthPermission(WRITE_PERMISSION);
    const supabase = await createClient();

    const name = String(formData.get('name') ?? '').trim();
    const type = parseType(formData.get('type'));
    const messagePreview = String(formData.get('messagePreview') ?? '').trim();
    const scheduledRaw = String(formData.get('scheduledAt') ?? '').trim();

    if (!name) return { error: 'Le nom de la campagne est requis' };
    if (!type) return { error: 'Type de campagne invalide' };

    const scheduledAt = scheduledRaw ? new Date(scheduledRaw).toISOString() : null;
    if (scheduledRaw && Number.isNaN(Date.parse(scheduledRaw))) {
      return { error: 'Date de planification invalide' };
    }

    await createCampaign(supabase, ctx.organizationId, {
      name,
      type,
      messagePreview: messagePreview || undefined,
      createdBy: ctx.userId,
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduledAt,
      metadata: { source: 'manual' },
    });

    revalidateCampaigns();
    return { success: 'Campagne créée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur création campagne' };
  }
}

export async function updateCampaignAction(
  _prev: CampaignCrudState,
  formData: FormData
): Promise<CampaignCrudState> {
  try {
    const ctx = await requireAuthPermission(WRITE_PERMISSION);
    const supabase = await createClient();

    const campaignId = String(formData.get('campaignId') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const type = parseType(formData.get('type'));
    const messagePreview = String(formData.get('messagePreview') ?? '').trim();

    if (!campaignId) return { error: 'Identifiant campagne manquant' };
    if (!name) return { error: 'Le nom de la campagne est requis' };
    if (!type) return { error: 'Type de campagne invalide' };

    await updateCampaign(supabase, ctx.organizationId, campaignId, {
      name,
      type,
      messagePreview: messagePreview || null,
    });

    revalidateCampaigns();
    return { success: 'Campagne mise à jour' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur modification campagne' };
  }
}

export async function deleteCampaignAction(campaignId: string): Promise<CampaignCrudState> {
  try {
    const ctx = await requireAuthPermission(WRITE_PERMISSION);
    const supabase = await createClient();
    if (!campaignId) return { error: 'Identifiant campagne manquant' };
    await deleteCampaign(supabase, ctx.organizationId, campaignId);
    revalidateCampaigns();
    return { success: 'Campagne supprimée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur suppression campagne' };
  }
}

export async function toggleCampaignStatusAction(
  campaignId: string,
  activate: boolean
): Promise<CampaignCrudState> {
  try {
    const ctx = await requireAuthPermission(WRITE_PERMISSION);
    const supabase = await createClient();
    if (!campaignId) return { error: 'Identifiant campagne manquant' };

    const status: CampaignStatus = activate ? 'ready' : 'paused';
    await setCampaignStatus(supabase, ctx.organizationId, campaignId, status);
    revalidateCampaigns();
    return {
      success: activate ? 'Campagne activée' : 'Campagne désactivée',
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur statut campagne' };
  }
}

export async function scheduleCampaignAction(
  _prev: CampaignCrudState,
  formData: FormData
): Promise<CampaignCrudState> {
  try {
    const ctx = await requireAuthPermission(WRITE_PERMISSION);
    const supabase = await createClient();

    const campaignId = String(formData.get('campaignId') ?? '').trim();
    const scheduledRaw = String(formData.get('scheduledAt') ?? '').trim();

    if (!campaignId) return { error: 'Identifiant campagne manquant' };
    if (!scheduledRaw || Number.isNaN(Date.parse(scheduledRaw))) {
      return { error: 'Date de planification invalide' };
    }

    await scheduleCampaign(
      supabase,
      ctx.organizationId,
      campaignId,
      new Date(scheduledRaw).toISOString()
    );
    revalidateCampaigns();
    return { success: 'Campagne planifiée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur planification' };
  }
}

export async function duplicateCampaignAction(
  campaignId: string
): Promise<CampaignCrudState> {
  try {
    const ctx = await requireAuthPermission(WRITE_PERMISSION);
    const supabase = await createClient();
    if (!campaignId) return { error: 'Identifiant campagne manquant' };
    await duplicateCampaign(supabase, ctx.organizationId, campaignId, ctx.userId);
    revalidateCampaigns();
    return { success: 'Campagne dupliquée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur duplication' };
  }
}
