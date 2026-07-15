'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { resetPasswordAction, type AuthActionState } from '../_actions/auth';

const initial: AuthActionState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
      )}
      <div>
        <label className="text-sm text-neutral-400">Nouveau mot de passe</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
        />
      </div>
      <div>
        <label className="text-sm text-neutral-400">Confirmer le mot de passe</label>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Mise à jour...' : 'Mettre à jour'}
      </Button>
    </form>
  );
}
