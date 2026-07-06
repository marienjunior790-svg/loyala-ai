'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { createReview, respondToReview, createNotification, getOrganization } from '@loyala/domain-crm';
import { proxyToWorker } from '@/lib/worker/client';

export type ReviewActionState = { error?: string; success?: string };

export async function createReviewAction(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const ctx = await requireAuth();
  const supabase = await createClient();

  const rating = Number(formData.get('rating'));
  const authorName = String(formData.get('authorName') ?? 'Client').trim();
  const content = String(formData.get('content') ?? '').trim();

  if (!rating || rating < 1 || rating > 5) return { error: 'Note invalide' };
  if (content.length < 3) return { error: 'Contenu requis' };

  try {
    await createReview(supabase, ctx.organizationId, { rating, authorName, content });
    await createNotification(supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: 'Nouvel avis',
      body: `${authorName} — ${rating}/5`,
      type: 'review',
      link: '/reviews',
    });
    revalidatePath('/reviews');
    return { success: 'Avis enregistré' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur' };
  }
}

export async function respondReviewAction(
  reviewId: string,
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const ctx = await requireAuth();
  const responseText = String(formData.get('responseText') ?? '').trim();
  if (responseText.length < 3) return { error: 'Réponse requise' };

  const supabase = await createClient();
  try {
    await respondToReview(supabase, ctx.organizationId, reviewId, responseText);
    revalidatePath('/reviews');
    return { success: 'Réponse enregistrée' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur' };
  }
}

export async function suggestReviewResponseAction(
  rating: number,
  content: string,
  authorName: string
): Promise<{ text?: string; error?: string }> {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const org = await getOrganization(supabase, ctx.organizationId);

  const workerResult = await proxyToWorker<{ reply?: string; needsHumanReview?: boolean }>(
    'inbox/reply',
    {
      method: 'POST',
      organizationId: ctx.organizationId,
      body: {
        message: `Avis client ${rating}/5 de ${authorName}: "${content}". Rédige une réponse professionnelle pour le restaurant.`,
        clientName: authorName,
        restaurantName: org?.name ?? 'Restaurant',
        context: 'review_response',
      },
    }
  );

  if (!workerResult.ok) {
    return { error: workerResult.error ?? 'IA indisponible' };
  }

  const reply = workerResult.data.reply;
  if (!reply) return { error: 'Réponse IA vide' };
  return { text: reply };
}
