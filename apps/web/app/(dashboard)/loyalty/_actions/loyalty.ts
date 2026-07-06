'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { addLoyaltyPoints } from '@loyala/domain-crm';

export type LoyaltyActionState = { error?: string; success?: string };

export async function addPointsAction(
  _prev: LoyaltyActionState,
  formData: FormData
): Promise<LoyaltyActionState> {
  const ctx = await requireAuth();
  const clientId = String(formData.get('clientId') ?? '');
  const points = Number(formData.get('points'));
  const reason = String(formData.get('reason') ?? 'Ajustement manuel').trim();

  if (!clientId || !points) return { error: 'Client et points requis' };

  const supabase = await createClient();
  try {
    const { newBalance } = await addLoyaltyPoints(supabase, ctx.organizationId, {
      clientId,
      pointsDelta: points,
      reason,
      createdBy: ctx.userId,
    });
    revalidatePath('/loyalty');
    revalidatePath('/clients');
    return { success: `Nouveau solde : ${newBalance} points` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur' };
  }
}
