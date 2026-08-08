'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  recordClientVisit,
  recordClientExpense,
  updateClientVisit,
  deleteClientVisit,
  getClient,
  getOrganization,
  getGoogleReviewUrl,
  isGoogleReviewAutoRequestEnabled,
  buildGoogleReviewRequestMessage,
  buildWhatsAppUrl,
  createNotification,
} from '@loyala/domain-crm';
import {
  recordVisitSchema,
  recordExpenseSchema,
  updateVisitSchema,
} from '@loyala/validation';
import { recordDomainEvent } from '@/lib/audit/record-domain-event';

export type VisitActionState = {
  error?: string;
  success?: string;
  /** wa.me link to ask for a Google review after the visit (when configured). */
  reviewWhatsappUrl?: string;
};

const REVALIDATE_PATHS = (clientId: string) => [
  `/clients/${clientId}`,
  '/clients',
  '/dashboard',
  '/segments',
  '/analytics',
  '/loyalty',
  '/reviews',
];

function revalidateVisitPaths(clientId: string) {
  for (const path of REVALIDATE_PATHS(clientId)) {
    revalidatePath(path);
  }
}

async function buildPostVisitReviewUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string,
  clientId: string
): Promise<string | undefined> {
  try {
    const [org, client] = await Promise.all([
      getOrganization(supabase, organizationId),
      getClient(supabase, organizationId, clientId),
    ]);
    if (!org || !client) return undefined;
    if (!isGoogleReviewAutoRequestEnabled(org.settings)) return undefined;
    if (!client.opt_in_whatsapp || !client.phone?.trim()) return undefined;

    const reviewUrl = getGoogleReviewUrl(org.settings);
    if (!reviewUrl) return undefined;

    const message = buildGoogleReviewRequestMessage({
      clientName: client.full_name,
      restaurantName: org.name,
      reviewUrl,
    });
    const wa = buildWhatsAppUrl(client.phone, message);

    await createNotification(supabase, {
      organizationId,
      userId,
      title: 'Demande d’avis Google',
      body: `Envoyer la demande WhatsApp à ${client.full_name}`,
      type: 'review',
      link: wa,
    }).catch(() => undefined);

    return wa;
  } catch {
    return undefined;
  }
}

export async function recordVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const ctx = await requireAuthPermission('clients:write');

  let items: unknown = undefined;
  const itemsRaw = formData.get('itemsJson');
  if (typeof itemsRaw === 'string' && itemsRaw.trim()) {
    try {
      const parsedItems = JSON.parse(itemsRaw);
      if (Array.isArray(parsedItems) && parsedItems.length > 0) items = parsedItems;
    } catch {
      return { error: 'Lignes d\'achat invalides' };
    }
  }

  const parsed = recordVisitSchema.safeParse({
    clientId: formData.get('clientId'),
    visitedAt: formData.get('visitedAt'),
    amount: formData.get('amount') || undefined,
    notes: formData.get('notes') || undefined,
    items,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();

  try {
    const visit = await recordClientVisit(supabase, ctx.organizationId, {
      ...parsed.data,
      createdBy: ctx.userId,
    });

    await recordDomainEvent(supabase, {
      organizationId: ctx.organizationId,
      eventType: 'client.visit.recorded',
      aggregateType: 'client',
      aggregateId: parsed.data.clientId,
      actorId: ctx.userId,
      payload: {
        visitId: visit.id,
        amount: visit.amount,
        visitedAt: visit.visited_at,
      },
    }).catch(() => undefined);

    const reviewWhatsappUrl = await buildPostVisitReviewUrl(
      supabase,
      ctx.organizationId,
      ctx.userId,
      parsed.data.clientId
    );

    revalidateVisitPaths(parsed.data.clientId);
    return {
      success: reviewWhatsappUrl
        ? 'Visite enregistrée — demande d’avis Google prête'
        : 'Visite enregistrée',
      reviewWhatsappUrl,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur enregistrement visite' };
  }
}

export async function recordExpenseAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const ctx = await requireAuthPermission('clients:write');

  const parsed = recordExpenseSchema.safeParse({
    clientId: formData.get('clientId'),
    visitedAt: formData.get('visitedAt'),
    amount: formData.get('amount'),
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();

  try {
    const expense = await recordClientExpense(supabase, ctx.organizationId, {
      ...parsed.data,
      createdBy: ctx.userId,
    });

    await recordDomainEvent(supabase, {
      organizationId: ctx.organizationId,
      eventType: 'client.expense.recorded',
      aggregateType: 'client',
      aggregateId: parsed.data.clientId,
      actorId: ctx.userId,
      payload: {
        visitId: expense.id,
        amount: expense.amount,
        visitedAt: expense.visited_at,
      },
    }).catch(() => undefined);

    revalidateVisitPaths(parsed.data.clientId);
    return { success: 'Dépense enregistrée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur enregistrement dépense' };
  }
}

export async function updateVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const ctx = await requireAuthPermission('clients:write');

  const parsed = updateVisitSchema.safeParse({
    visitId: formData.get('visitId'),
    clientId: formData.get('clientId'),
    visitedAt: formData.get('visitedAt'),
    amount: formData.get('amount') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();

  try {
    await updateClientVisit(supabase, ctx.organizationId, parsed.data);
    revalidateVisitPaths(parsed.data.clientId);
    return { success: 'Visite mise à jour' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur mise à jour' };
  }
}

export async function deleteVisitAction(
  clientId: string,
  visitId: string
): Promise<VisitActionState> {
  const ctx = await requireAuthPermission('clients:write');
  const supabase = await createClient();

  try {
    await deleteClientVisit(supabase, ctx.organizationId, clientId, visitId);
    revalidateVisitPaths(clientId);
    return { success: 'Visite supprimée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur suppression' };
  }
}
