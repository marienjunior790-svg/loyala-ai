'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { onboardingSchema } from '@loyala/validation';
import { ORG_COOKIE_NAME } from '@loyala/core-iam';
import { recordDomainEvent } from '@/lib/audit/record-domain-event';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) + '-' + Math.random().toString(36).slice(2, 7);
}

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

  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);

  if (existing?.length) {
    redirect('/dashboard');
  }

  const { data: ownerRole, error: ownerRoleError } = await supabase
    .from('roles')
    .select('id')
    .eq('scope', 'organization')
    .eq('code', 'org_owner')
    .single();

  if (ownerRoleError) {
    console.error('[onboarding] owner role lookup failed', ownerRoleError);
    return {
      error:
        ownerRoleError.code === '42501'
          ? 'Permissions rôles manquantes. Appliquez la migration 006.'
          : ownerRoleError.message,
    };
  }

  if (!ownerRole) return { error: 'Configuration rôles manquante. Appliquez la migration 006.' };

  const slug = slugify(parsed.data.organizationName);

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: parsed.data.organizationName,
      slug,
      country_code: parsed.data.countryCode,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
    })
    .select()
    .single();

  if (orgError || !org) return { error: orgError?.message ?? 'Erreur création organisation' };

  const { error: memberError } = await supabase.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role_id: ownerRole.id,
    status: 'active',
  });

  if (memberError) return { error: memberError.message };

  await recordDomainEvent(supabase, {
    organizationId: org.id,
    eventType: 'organization.created',
    aggregateType: 'organization',
    aggregateId: org.id,
    actorId: user.id,
    payload: { name: org.name, slug: org.slug, countryCode: parsed.data.countryCode },
  });

  await recordDomainEvent(supabase, {
    organizationId: org.id,
    eventType: 'member.joined',
    aggregateType: 'organization_member',
    aggregateId: org.id,
    actorId: user.id,
    payload: { userId: user.id, role: 'org_owner' },
  });

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE_NAME, org.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  redirect('/dashboard');
}
