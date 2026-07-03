'use client';

import { useActionState } from 'react';
import { Button } from '@loyala/ui';
import { completeOnboardingAction, type OnboardingState } from './_actions/onboarding';

const initial: OnboardingState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(completeOnboardingAction, initial);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
      )}
      <div>
        <label className="text-sm text-neutral-400">Nom du restaurant</label>
        <input
          name="organizationName"
          required
          minLength={2}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
          placeholder="Le Petit Dakar"
        />
      </div>
      <div>
        <label className="text-sm text-neutral-400">Pays</label>
        <select
          name="countryCode"
          defaultValue="SN"
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
        >
          <option value="SN">Sénégal</option>
          <option value="CI">Côte d&apos;Ivoire</option>
          <option value="MA">Maroc</option>
          <option value="NG">Nigeria</option>
        </select>
      </div>
      <div>
        <label className="text-sm text-neutral-400">Fuseau horaire</label>
        <select
          name="timezone"
          defaultValue="Africa/Dakar"
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
        >
          <option value="Africa/Dakar">Africa/Dakar (GMT+0)</option>
          <option value="Africa/Abidjan">Africa/Abidjan (GMT+0)</option>
          <option value="Africa/Casablanca">Africa/Casablanca (GMT+1)</option>
          <option value="Africa/Lagos">Africa/Lagos (GMT+1)</option>
        </select>
      </div>
      <div>
        <label className="text-sm text-neutral-400">Devise</label>
        <select
          name="currency"
          defaultValue="XOF"
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
        >
          <option value="XOF">XOF (Franc CFA UEMOA)</option>
          <option value="XAF">XAF (Franc CFA CEMAC)</option>
          <option value="MAD">MAD (Dirham marocain)</option>
          <option value="NGN">NGN (Naira)</option>
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Configuration...' : 'Lancer Loyala AI'}
      </Button>
    </form>
  );
}
