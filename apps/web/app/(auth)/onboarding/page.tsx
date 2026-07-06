import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { getActiveMembership } from '@/lib/auth/membership';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const membership = await getActiveMembership(supabase);

  if (membership) redirect('/clients');

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Onboarding</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Configurez votre restaurant</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Moins de 2 minutes pour un CRM prêt à générer du revenu.
        </p>
        <OnboardingWizard />
      </div>
    </main>
  );
}
