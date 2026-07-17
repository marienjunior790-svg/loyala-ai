'use server';

import { revalidatePath } from 'next/cache';
import type { OrgRole } from '@loyala/core-iam';
import { requireAuth } from '@/lib/auth/guard';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  listClients,
  syncClientSegments,
  getOrganization,
  persistCampaignPlans,
  getClientsPurchaseInsights,
  isAffinityEligible,
  type CampaignPlanPayload,
} from '@loyala/domain-crm';
import { notifyCampaignReadyByEmail } from '@loyala/integrations';
import { proxyToWorker } from '@/lib/worker/client';

const CAMPAIGN_WRITE_ROLES: OrgRole[] = ['org_owner', 'org_admin', 'org_manager', 'org_staff'];

function canRunCampaigns(role: OrgRole): boolean {
  return CAMPAIGN_WRITE_ROLES.includes(role);
}

export type ModuleActionState = { error?: string; success?: string; campaignId?: string };

async function generateLoyaltyCampaign(
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  campaignType: 'inactive' | 'birthday',
  filterClients: (clients: Awaited<ReturnType<typeof listClients>>) => Awaited<ReturnType<typeof listClients>>
): Promise<ModuleActionState> {
  const supabase = await createClient();

  const org = await getOrganization(supabase, ctx.organizationId);
  let clients = await listClients(supabase, ctx.organizationId);
  await syncClientSegments(supabase, ctx.organizationId, clients);
  clients = await listClients(supabase, ctx.organizationId);

  const targets = filterClients(clients).filter((c) => c.opt_in_whatsapp && c.phone);
  if (targets.length === 0) {
    return {
      error:
        campaignType === 'birthday'
          ? 'Aucun anniversaire aujourd\'hui avec opt-in WhatsApp'
          : 'Aucun client inactif à relancer',
    };
  }

  const workerPath = campaignType === 'birthday' ? 'campaigns/birthday' : 'campaigns/loyalty';
  const workerBody =
    campaignType === 'birthday'
      ? {
          clients: targets.map((c) => ({
            clientId: c.id,
            fullName: c.full_name,
            birthday: c.date_of_birth ?? new Date().toISOString(),
          })),
          restaurantName: org?.name ?? 'Restaurant',
        }
      : {
          clients: targets.map((c) => ({
            clientId: c.id,
            fullName: c.full_name,
            loyaltyPoints: c.loyalty_points,
            lastVisit: c.last_visit_at ?? new Date(0).toISOString(),
          })),
        };

  const workerResult = await proxyToWorker<{ campaigns?: CampaignPlanPayload[] }>(workerPath, {
    method: 'POST',
    organizationId: ctx.organizationId,
    body: workerBody,
  });

  if (!workerResult.ok) {
    return { error: workerResult.error ?? 'Worker IA indisponible' };
  }

  const plans = workerResult.data.campaigns ?? [];
  const campaignName =
    campaignType === 'birthday'
      ? `Anniversaires — ${new Date().toLocaleDateString('fr-FR')}`
      : `Relance inactifs — ${new Date().toLocaleDateString('fr-FR')}`;

  const { sendCount } = await persistCampaignPlans(supabase, {
    organizationId: ctx.organizationId,
    restaurantName: org?.name ?? 'Restaurant',
    campaignType,
    campaignName,
    plans,
    clients: targets.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      opt_in_whatsapp: c.opt_in_whatsapp,
    })),
    createdBy: ctx.userId,
    source: 'manual',
  });

  const session = await getSession();
  if (session?.email) {
    try {
      await notifyCampaignReadyByEmail({
        to: session.email,
        restaurantName: org?.name ?? 'Restaurant',
        count: sendCount,
        campaignType: campaignType === 'birthday' ? 'anniversaire' : 'inactifs',
      });
    } catch {
      // Email is optional — in-app notification already created
    }
  }

  if (sendCount === 0) {
    return {
      error:
        plans.length === 0
          ? 'Le worker IA n\'a généré aucun message — vérifiez la configuration worker'
          : 'Aucune relance enregistrée (clients sans opt-in WhatsApp ou numéro manquant)',
    };
  }

  revalidatePath('/campaigns');
  revalidatePath('/relances');
  revalidatePath('/notifications');
  return {
    success: `${sendCount} relance(s) générée(s) — consultez Relances pour envoyer`,
  };
}

export async function generateInactiveCampaignAction(
  _prev: ModuleActionState,
  _formData: FormData
): Promise<ModuleActionState> {
  const ctx = await requireAuth();
  if (!canRunCampaigns(ctx.role)) {
    return { error: 'Permission insuffisante — rôle lecture seule (org_viewer)' };
  }
  const supabase = await createClient();

  try {
    let clients = await listClients(supabase, ctx.organizationId);
    await syncClientSegments(supabase, ctx.organizationId, clients);
    clients = await listClients(supabase, ctx.organizationId);

    const { isClientInactive } = await import('@loyala/domain-crm');
    return await generateLoyaltyCampaign(ctx, 'inactive', (list) =>
      list.filter((c) => isClientInactive(c))
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur génération campagne' };
  }
}

export async function generateBirthdayCampaignAction(
  _prev: ModuleActionState,
  _formData: FormData
): Promise<ModuleActionState> {
  const ctx = await requireAuth();
  if (!canRunCampaigns(ctx.role)) {
    return { error: 'Permission insuffisante — rôle lecture seule (org_viewer)' };
  }

  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    return await generateLoyaltyCampaign(ctx, 'birthday', (list) =>
      list.filter((c) => {
        if (!c.date_of_birth) return false;
        const dob = new Date(c.date_of_birth);
        return dob.getMonth() + 1 === month && dob.getDate() === day;
      })
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur génération anniversaires' };
  }
}

/**
 * Manual affinity re-engagement trigger. Reuses the exact worker AI logic
 * (`automation.runAffinityRelances` via the `campaigns/affinity` route) instead
 * of duplicating message generation. Eligibility (opt-in, dormant >= 30 days,
 * identifiable favorite product) is enforced against the RLS-scoped org data.
 */
export async function generateAffinityCampaignAction(
  _prev: ModuleActionState,
  _formData: FormData
): Promise<ModuleActionState> {
  const ctx = await requireAuth();
  if (!canRunCampaigns(ctx.role)) {
    return { error: 'Permission insuffisante — rôle lecture seule (org_viewer)' };
  }

  const noEligible = 'Aucun client éligible pour une relance affinité actuellement.';

  try {
    const supabase = await createClient();
    const org = await getOrganization(supabase, ctx.organizationId);
    const clients = await listClients(supabase, ctx.organizationId);

    const candidates = clients.filter((c) => c.opt_in_whatsapp && c.phone);
    if (candidates.length === 0) {
      return {
        error: `${noEligible} Aucun client avec opt-in WhatsApp et numéro de téléphone.`,
      };
    }

    const insightsMap = await getClientsPurchaseInsights(
      supabase,
      ctx.organizationId,
      candidates.map((c) => c.id)
    );

    const targets = candidates.filter((c) =>
      isAffinityEligible(
        { opt_in_whatsapp: c.opt_in_whatsapp, phone: c.phone, last_visit_at: c.last_visit_at },
        insightsMap.get(c.id)
      )
    );

    if (targets.length === 0) {
      const now = Date.now();
      const dormant = candidates.filter(
        (c) =>
          !c.last_visit_at ||
          (now - new Date(c.last_visit_at).getTime()) / 86_400_000 >= 30
      ).length;
      const withFavorite = candidates.filter(
        (c) => insightsMap.get(c.id)?.favoriteProduct
      ).length;
      return {
        error:
          `${noEligible} Sur ${candidates.length} client(s) opt-in : ` +
          `${dormant} sans achat depuis 30 jours, ${withFavorite} avec un produit préféré identifié. ` +
          `Enregistrez des visites avec des articles du catalogue pour activer la relance par affinité.`,
      };
    }

    const workerResult = await proxyToWorker<{ campaigns?: CampaignPlanPayload[] }>(
      'campaigns/affinity',
      {
        method: 'POST',
        organizationId: ctx.organizationId,
        body: {
          clients: targets.map((c) => {
            const i = insightsMap.get(c.id);
            return {
              clientId: c.id,
              fullName: c.full_name,
              loyaltyPoints: c.loyalty_points,
              lastVisit: c.last_visit_at ?? new Date(0).toISOString(),
              insights: i
                ? {
                    favoriteProduct: i.favoriteProduct?.name ?? null,
                    favoriteCategory: i.favoriteCategory?.name ?? null,
                    averageBasket: i.averageBasket,
                    totalSpent: i.totalSpent,
                    bestMonth: i.bestMonth?.month ?? null,
                    isVip: i.isVipCandidate,
                  }
                : undefined,
            };
          }),
        },
      }
    );

    if (!workerResult.ok) {
      return { error: workerResult.error ?? 'Worker IA indisponible' };
    }

    const plans = workerResult.data.campaigns ?? [];
    if (plans.length === 0) {
      return { error: noEligible };
    }

    const campaignName = `Relance affinité — ${new Date().toLocaleDateString('fr-FR')}`;
    const { campaignId, sendCount } = await persistCampaignPlans(supabase, {
      organizationId: ctx.organizationId,
      restaurantName: org?.name ?? 'Restaurant',
      campaignType: 'promotion',
      campaignName,
      plans,
      clients: targets.map((c) => ({
        id: c.id,
        full_name: c.full_name,
        phone: c.phone,
        opt_in_whatsapp: c.opt_in_whatsapp,
      })),
      createdBy: ctx.userId,
      source: 'manual',
    });

    if (sendCount === 0) {
      return {
        error:
          'Aucune relance enregistrée (clients sans opt-in WhatsApp ou numéro manquant)',
      };
    }

    const session = await getSession();
    if (session?.email) {
      try {
        await notifyCampaignReadyByEmail({
          to: session.email,
          restaurantName: org?.name ?? 'Restaurant',
          count: sendCount,
          campaignType: 'affinité',
        });
      } catch {
        // Email is optional — in-app notification already created
      }
    }

    revalidatePath('/campaigns');
    revalidatePath('/relances');
    revalidatePath('/notifications');
    return {
      success: `Campagne « ${campaignName} » créée : ${sendCount} client(s) ciblé(s) — ${plans.length} message(s) généré(s). Consultez Relances pour envoyer.`,
      campaignId,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur génération relance affinité' };
  }
}

export async function markRelanceSentAction(sendId: string): Promise<ModuleActionState> {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const { markCampaignSendSent } = await import('@loyala/domain-crm');

  try {
    await markCampaignSendSent(supabase, ctx.organizationId, sendId);
    revalidatePath('/relances');
    revalidatePath('/dashboard');
    return { success: 'Relance marquée comme envoyée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur' };
  }
}
