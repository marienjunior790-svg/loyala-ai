import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { getActiveMembership } from '@/lib/auth/membership';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const membership = await getActiveMembership(supabase);

  if (membership) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">Configurez votre restaurant</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Dernière étape avant d&apos;accéder à votre CRM.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
