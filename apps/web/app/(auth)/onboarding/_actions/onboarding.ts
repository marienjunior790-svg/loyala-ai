'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { getActiveMembership } from '@/lib/auth/membership';
import { onboardingSchema } from '@loyala/validation';
import { ORG_COOKIE_NAME } from '@loyala/core-iam';

export type OnboardingState = { error?: string };

export async function completeOnboardingAction(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const user = await getSession();
  if (!user) return { error: 'Non authentifié' };

  const parsed = onboardingSchema.safeParse({
    organizationName: formData.get('organizationName'),
    countryCode: formData.get('countryCode') || 'SN',
    timezone: formData.get('timezone') || 'Africa/Dakar',
    currency: formData.get('currency') || 'XOF',
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();

  const existing = await getActiveMembership(supabase);
  if (existing?.organization_id) {
    const cookieStore = await cookies();
    cookieStore.set(ORG_COOKIE_NAME, existing.organization_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    redirect('/clients/ajouter?welcome=1');
  }

  const { data: onboardingRows, error: onboardingError } = await supabase.rpc('complete_onboarding', {
    p_organization_name: parsed.data.organizationName,
    p_country_code: parsed.data.countryCode,
    p_timezone: parsed.data.timezone,
    p_currency: parsed.data.currency,
  });

  if (onboardingError) {
    console.error('[onboarding] complete_onboarding failed', onboardingError);
    return { error: onboardingError.message };
  }

  const onboardingResult = Array.isArray(onboardingRows)
    ? onboardingRows[0]
    : onboardingRows;

  if (!onboardingResult?.organization_id) {
    return { error: 'Impossible de créer votre restaurant. Réessayez ou contactez le support.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE_NAME, onboardingResult.organization_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  redirect('/clients/ajouter?welcome=1');
}
