'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { createReview, respondToReview, createNotification } from '@loyala/domain-crm';

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

function suggestReviewResponse(rating: number, content: string): string {
  if (rating >= 4) {
    return `Merci beaucoup pour votre avis ${rating}/5 ! Nous sommes ravis que vous ayez apprécié votre expérience. Au plaisir de vous revoir très bientôt.`;
  }
  if (rating === 3) {
    return `Merci pour votre retour. Nous prenons note de vos remarques pour améliorer votre prochaine visite. N'hésitez pas à nous contacter directement.`;
  }
  return `Nous sommes désolés que votre expérience n'ait pas été à la hauteur. Contactez-nous pour que nous puissions corriger cela : ${content.slice(0, 80)}…`;
}

export async function suggestReviewResponseAction(
  reviewId: string,
  rating: number,
  content: string
): Promise<{ text?: string; error?: string }> {
  await requireAuth();
  return { text: suggestReviewResponse(rating, content) };
}
