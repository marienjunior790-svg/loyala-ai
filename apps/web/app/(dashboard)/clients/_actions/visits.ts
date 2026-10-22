'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { canChangeOrder, canRefundOrder, type OrderAuthorship } from '@/lib/auth/clients-access';
import { createClient } from '@/lib/supabase/server';
import {
  recordClientVisit,
  updateClientVisit,
  cancelClientOrder,
  refundClientOrder,
  getClient,
  getOrganization,
  getGoogleReviewUrl,
  isGoogleReviewAutoRequestEnabled,
  buildGoogleReviewRequestMessage,
  buildWhatsAppUrl,
  createNotification,
  resolveStaffSale,
  staffSaleIdentity,
  type CatalogSaleSource,
} from '@loyala/domain-crm';
import {
  recordVisitSchema,
  updateVisitSchema,
  cancelOrderSchema,
  refundOrderSchema,
  type VisitItemInput,
} from '@loyala/validation';
import { recordDomainEvent } from '@/lib/audit/record-domain-event';

export type VisitActionState = {
  error?: string;
  success?: string;
  /** wa.me link to ask for a Google review after the visit (when configured). */
  reviewWhatsappUrl?: string;
  /** Répétition identique : aucune nouvelle commande et aucun nouveau point. */
  alreadyRecorded?: boolean;
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

const ORDER_CHANGE_DENIED =
  'Après 15 minutes, ou pour la commande d’un autre membre, seul un gérant, un administrateur ou le propriétaire peut modifier ou annuler.';
const REFUND_DENIED = 'Seuls le propriétaire, un administrateur ou un gérant peuvent rembourser une commande.';

async function loadOrderAuthorship(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  orderId: string
): Promise<OrderAuthorship | null> {
  const { data, error } = await supabase
    .from('client_visits')
    .select('created_by, created_at')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function pointsNote(pointsDelta: number): string {
  if (pointsDelta === 0) return '';
  const abs = Math.abs(pointsDelta);
  return pointsDelta > 0 ? ` · +${abs} pts` : ` · ${abs} pts retirés`;
}

const SALE_CONFLICT =
  'Cette saisie a déjà été enregistrée avec des données différentes. La commande d’origine n’a pas été modifiée. Fermez puis rouvrez pour une nouvelle commande.';

function categoryNameOf(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return categoryNameOf(value[0]);
  if (typeof value === 'object' && value !== null && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

async function loadSaleCatalog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  items: VisitItemInput[]
): Promise<CatalogSaleSource[]> {
  const ids = [...new Set(items.map((item) => item.catalogItemId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('catalog_items')
    .select('id, organization_id, name, price, currency, type, is_active, metadata, catalog_categories(name)')
    .eq('organization_id', organizationId)
    .in('id', ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    price: Number(row.price),
    currency: String(row.currency),
    type: row.type as CatalogSaleSource['type'],
    isActive: Boolean(row.is_active),
    categoryName: categoryNameOf(row.catalog_categories),
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
  }));
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
    const wa = buildWhatsAppUrl(client.phone_e164 || client.phone, message, org.country_code);

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
    orderType: formData.get('orderType') || undefined,
    paymentMethod: formData.get('paymentMethod') || undefined,
    amount: formData.get('amount') || undefined,
    discount: formData.get('discount') || undefined,
    notes: formData.get('notes') || undefined,
    items,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const submissionKey = String(formData.get('idempotencyKey') ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey)) {
    return { error: 'Saisie incomplète. Fermez la commande et rouvrez-la.' };
  }

  const supabase = await createClient();

  try {
    const catalog = await loadSaleCatalog(supabase, ctx.organizationId, parsed.data.items ?? []);
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('timezone')
      .eq('id', ctx.organizationId)
      .maybeSingle();
    const priced = resolveStaffSale({
      organizationId: ctx.organizationId,
      items: parsed.data.items,
      amount: parsed.data.amount,
      discount: parsed.data.discount,
      catalog,
      timeZone: orgRow?.timezone || 'Africa/Dakar',
    });
    if (!priced.ok) return { error: priced.error };

    const saleInput = {
      ...parsed.data,
      discount: priced.discount,
      items: priced.sale.mode === 'lines' ? priced.sale.items : undefined,
      amount: priced.sale.mode === 'amount' ? priced.sale.amount : undefined,
    };
    const recorded = await recordClientVisit(
      supabase,
      ctx.organizationId,
      saleInput,
      staffSaleIdentity(submissionKey, priced.sale.currency)
    );

    if (recorded.outcome === 'duplicate') {
      revalidateVisitPaths(parsed.data.clientId);
      return { success: 'Cette commande était déjà enregistrée.', alreadyRecorded: true };
    }
    if (recorded.outcome === 'conflict' || recorded.outcome === 'rejected' || !recorded.order) {
      return { error: SALE_CONFLICT };
    }

    const { order, pointsDelta } = recorded;

    await recordDomainEvent(supabase, {
      organizationId: ctx.organizationId,
      eventType: 'client.visit.recorded',
      aggregateType: 'client',
      aggregateId: parsed.data.clientId,
      actorId: ctx.userId,
      payload: {
        visitId: order.id,
        amount: order.amount,
        visitedAt: order.visited_at,
        orderType: order.order_type,
        paymentMethod: order.payment_method,
        pointsDelta,
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
        ? `Commande enregistrée${pointsNote(pointsDelta)} — demande d’avis Google prête`
        : `Commande enregistrée${pointsNote(pointsDelta)}`,
      reviewWhatsappUrl,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur enregistrement commande' };
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
    orderType: formData.get('orderType') || undefined,
    paymentMethod: formData.get('paymentMethod') || undefined,
    amount: formData.get('amount') || undefined,
    discount: formData.get('discount') || undefined,
    notes: formData.get('notes') ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();

  try {
    const order = await loadOrderAuthorship(supabase, ctx.organizationId, parsed.data.visitId);
    if (!order) return { error: 'Commande introuvable' };
    if (!canChangeOrder(ctx, order)) return { error: ORDER_CHANGE_DENIED };

    const { pointsDelta } = await updateClientVisit(supabase, ctx.organizationId, parsed.data);
    revalidateVisitPaths(parsed.data.clientId);
    return { success: `Commande mise à jour${pointsNote(pointsDelta)}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur mise à jour' };
  }
}

export async function cancelVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const ctx = await requireAuthPermission('clients:write');

  const parsed = cancelOrderSchema.safeParse({
    visitId: formData.get('visitId'),
    clientId: formData.get('clientId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();
  try {
    const authorship = await loadOrderAuthorship(supabase, ctx.organizationId, parsed.data.visitId);
    if (!authorship) return { error: 'Commande introuvable' };
    if (!canChangeOrder(ctx, authorship)) return { error: ORDER_CHANGE_DENIED };

    const { order, pointsDelta } = await cancelClientOrder(supabase, ctx.organizationId, parsed.data);
    await recordDomainEvent(supabase, {
      organizationId: ctx.organizationId,
      eventType: 'client.visit.cancelled',
      aggregateType: 'client',
      aggregateId: parsed.data.clientId,
      actorId: ctx.userId,
      payload: { visitId: order.id, amount: order.amount, reason: parsed.data.reason, pointsDelta },
    }).catch(() => undefined);
    revalidateVisitPaths(parsed.data.clientId);
    const untouched = pointsDelta === 0 && order.source === 'historique' ? ' · points d’origine non reliés, solde inchangé' : '';
    return { success: `Commande annulée${pointsNote(pointsDelta)}${untouched}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur annulation' };
  }
}

export async function refundVisitAction(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  const ctx = await requireAuthPermission('clients:write');
  if (!canRefundOrder(ctx)) return { error: REFUND_DENIED };

  const parsed = refundOrderSchema.safeParse({
    visitId: formData.get('visitId'),
    clientId: formData.get('clientId'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();
  try {
    const { order, pointsDelta } = await refundClientOrder(supabase, ctx.organizationId, parsed.data);
    await recordDomainEvent(supabase, {
      organizationId: ctx.organizationId,
      eventType: 'client.visit.refunded',
      aggregateType: 'client',
      aggregateId: parsed.data.clientId,
      actorId: ctx.userId,
      payload: { visitId: order.id, refunded: parsed.data.amount, reason: parsed.data.reason, pointsDelta },
    }).catch(() => undefined);
    revalidateVisitPaths(parsed.data.clientId);
    return { success: `Remboursement enregistré${pointsNote(pointsDelta)}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur remboursement' };
  }
}
