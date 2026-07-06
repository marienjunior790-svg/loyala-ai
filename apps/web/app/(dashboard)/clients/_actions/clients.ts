'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAuthPermission } from '@/lib/auth/guard';
import { canDeleteClients } from '@/lib/auth/clients-access';
import { createClient as createDbClient } from '@/lib/supabase/server';
import {
  createClient as createCrmClient,
  updateClient,
  softDeleteClient,
} from '@loyala/domain-crm';
import { createClientSchema, updateClientSchema } from '@loyala/validation';
import { recordDomainEvent } from '@/lib/audit/record-domain-event';

export type ClientActionState = {
  error?: string;
  success?: boolean;
  clientName?: string;
  clientPhone?: string;
  optInWhatsapp?: boolean;
};

export async function createClientAction(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const ctx = await requireAuthPermission('clients:write');

  const parsed = createClientSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    email: formData.get('email') || undefined,
    optInWhatsapp: formData.get('optInWhatsapp') === 'on',
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createDbClient();

  try {
    const client = await createCrmClient(supabase, ctx.organizationId, parsed.data);

    await recordDomainEvent(supabase, {
      organizationId: ctx.organizationId,
      eventType: 'client.created',
      aggregateType: 'client',
      aggregateId: client.id,
      actorId: ctx.userId,
      payload: { clientId: client.id, fullName: client.full_name },
    });

    revalidatePath('/clients');
    return {
      success: true,
      clientName: client.full_name,
      clientPhone: client.phone,
      optInWhatsapp: client.opt_in_whatsapp,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur création client' };
  }
}

export async function updateClientAction(
  clientId: string,
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const ctx = await requireAuthPermission('clients:write');

  const parsed = updateClientSchema.safeParse({
    fullName: formData.get('fullName') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    optInWhatsapp: formData.get('optInWhatsapp') === 'on',
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createDbClient();

  try {
    const client = await updateClient(supabase, ctx.organizationId, clientId, parsed.data);

    await recordDomainEvent(supabase, {
      organizationId: ctx.organizationId,
      eventType: 'client.updated',
      aggregateType: 'client',
      aggregateId: client.id,
      actorId: ctx.userId,
      payload: { clientId: client.id, fullName: client.full_name },
    });

    revalidatePath('/clients');
    revalidatePath(`/clients/${clientId}`);
    redirect(`/clients/${clientId}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur mise à jour' };
  }
}

export async function deleteClientAction(clientId: string): Promise<ClientActionState> {
  const ctx = await requireAuthPermission('clients:read');
  if (!canDeleteClients(ctx)) {
    return { error: 'Permission refusée' };
  }

  const supabase = await createDbClient();

  try {
    await softDeleteClient(supabase, ctx.organizationId, clientId);

    await recordDomainEvent(supabase, {
      organizationId: ctx.organizationId,
      eventType: 'client.deleted',
      aggregateType: 'client',
      aggregateId: clientId,
      actorId: ctx.userId,
      payload: { clientId },
    });

    revalidatePath('/clients');
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur suppression' };
  }
}
