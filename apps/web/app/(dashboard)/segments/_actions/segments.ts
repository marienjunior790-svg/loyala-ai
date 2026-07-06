'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { listClients, syncClientSegments } from '@loyala/domain-crm';
import { proxyToWorker } from '@/lib/worker/client';

export async function syncSegmentsAction(): Promise<{ success?: string; error?: string }> {
  const ctx = await requireAuth();
  const supabase = await createClient();

  try {
    let clients = await listClients(supabase, ctx.organizationId);
    await syncClientSegments(supabase, ctx.organizationId, clients);
    clients = await listClients(supabase, ctx.organizationId);

    const workerClients = clients.map((c) => ({
      clientId: c.id,
      fullName: c.full_name,
      recencyDays: c.last_visit_at
        ? Math.floor((Date.now() - new Date(c.last_visit_at).getTime()) / 86400000)
        : 999,
      frequency: c.visit_count,
      monetary: Number(c.total_spent),
    }));

    const workerResult = await proxyToWorker('segment', {
      method: 'POST',
      organizationId: ctx.organizationId,
      body: { clients: workerClients },
    });

    if (!workerResult.ok) {
      return { error: workerResult.error ?? 'Worker IA indisponible pour la segmentation' };
    }

    revalidatePath('/segments');
    revalidatePath('/clients');
    revalidatePath('/dashboard');
    return { success: `${clients.length} clients synchronisés` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur synchronisation' };
  }
}
