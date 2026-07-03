import { OnboardingForm } from './onboarding-form';

export default function OnboardingPage() {
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
