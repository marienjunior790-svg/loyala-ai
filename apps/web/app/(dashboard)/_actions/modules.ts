'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  listClients,
  syncClientSegments,
  createCampaign,
  createCampaignSend,
  getOrganization,
  createNotification,
  isClientInactive,
  computeClientSegment,
} from '@loyala/domain-crm';
import { proxyToWorker } from '@/lib/worker/client';
import { buildWhatsAppUrl, buildClientRelanceMessage } from '@/lib/whatsapp';

export type ModuleActionState = { error?: string; success?: string };

export async function generateInactiveCampaignAction(
  _prev: ModuleActionState,
  _formData: FormData
): Promise<ModuleActionState> {
  const ctx = await requireAuth();
  const supabase = await createClient();

  try {
    const org = await getOrganization(supabase, ctx.organizationId);
    let clients = await listClients(supabase, ctx.organizationId);
    await syncClientSegments(supabase, ctx.organizationId, clients);
    clients = await listClients(supabase, ctx.organizationId);

    const inactive = clients.filter((c) => isClientInactive(c) && c.opt_in_whatsapp);
    if (inactive.length === 0) {
      return { error: 'Aucun client inactif à relancer' };
    }

    const workerClients = inactive.map((c) => ({
      clientId: c.id,
      fullName: c.full_name,
      phone: c.phone,
      lastVisitAt: c.last_visit_at,
      visitCount: c.visit_count,
      totalSpent: Number(c.total_spent),
      loyaltyPoints: c.loyalty_points,
      lastVisit: c.last_visit_at ?? new Date(0).toISOString(),
    }));

    const workerResult = await proxyToWorker<{ campaigns?: { message?: string; clientId?: string }[] }>(
      'campaigns/loyalty',
      { method: 'POST', organizationId: ctx.organizationId, body: { clients: workerClients } }
    );

    const messages = workerResult.ok ? workerResult.data.campaigns ?? [] : [];

    const campaign = await createCampaign(supabase, ctx.organizationId, {
      type: 'inactive',
      name: `Relance inactifs — ${new Date().toLocaleDateString('fr-FR')}`,
      targetCount: inactive.length,
      messagePreview: messages[0]?.message ?? 'Relance personnalisée',
      createdBy: ctx.userId,
    });

    for (const client of inactive) {
      const aiMsg = messages.find((m) => m.clientId === client.id)?.message;
      const body =
        aiMsg ??
        buildClientRelanceMessage({
          clientName: client.full_name,
          restaurantName: org?.name ?? 'votre restaurant',
        });
      const url = buildWhatsAppUrl(client.phone, body);
      await createCampaignSend(supabase, ctx.organizationId, {
        campaignId: campaign.id,
        clientId: client.id,
        messageBody: body,
        whatsappUrl: url,
      });
    }

    await createNotification(supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: 'Campagne prête',
      body: `${inactive.length} relances inactifs générées`,
      type: 'campaign',
      link: '/relances',
    });

    revalidatePath('/campaigns');
    revalidatePath('/relances');
    return { success: `${inactive.length} relances générées — consultez Relances pour envoyer` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur génération campagne' };
  }
}

export async function recordRelanceAction(
  clientId: string,
  message: string,
  whatsappUrl: string
): Promise<void> {
  const ctx = await requireAuth();
  const supabase = await createClient();

  await createCampaignSend(supabase, ctx.organizationId, {
    clientId,
    messageBody: message,
    whatsappUrl,
    status: 'sent',
  });

  revalidatePath('/relances');
  revalidatePath('/dashboard');
}

export async function getSegmentStatsAction() {
  const ctx = await requireAuth();
  const supabase = await createClient();
  let clients = await listClients(supabase, ctx.organizationId);
  await syncClientSegments(supabase, ctx.organizationId, clients);
  clients = await listClients(supabase, ctx.organizationId);

  const map = new Map<string, number>();
  for (const c of clients) {
    const seg = computeClientSegment(c);
    map.set(seg, (map.get(seg) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([segment, count]) => ({ segment, count }));
}
