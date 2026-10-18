'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { canAdjustLoyalty } from '@/lib/auth/clients-access';
import { createClient } from '@/lib/supabase/server';
import { addLoyaltyPoints } from '@loyala/domain-crm';

export type LoyaltyActionState = { error?: string; success?: string };

export async function addPointsAction(
  _prev: LoyaltyActionState,
  formData: FormData
): Promise<LoyaltyActionState> {
  const ctx = await requireAuth();
  if (!canAdjustLoyalty(ctx)) {
    return { error: 'Seuls le propriétaire, un administrateur ou un gérant peuvent ajuster les points.' };
  }

  const clientId = String(formData.get('clientId') ?? '');
  const points = Number(formData.get('points'));
  const reason = String(formData.get('reason') ?? '').trim() || 'Ajustement manuel';

  if (!clientId || !points) return { error: 'Client et points requis' };
  if (!Number.isInteger(points)) return { error: 'Les points doivent être un nombre entier' };

  const supabase = await createClient();
  try {
    const { newBalance } = await addLoyaltyPoints(supabase, ctx.organizationId, {
      clientId,
      pointsDelta: points,
      reason,
    });
    revalidatePath('/loyalty');
    revalidatePath('/clients');
    return { success: `Nouveau solde : ${newBalance} points` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur' };
  }
}
