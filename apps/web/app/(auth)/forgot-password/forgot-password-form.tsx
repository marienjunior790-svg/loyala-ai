'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { forgotPasswordAction, type AuthActionState } from '../_actions/auth';

const initial: AuthActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initial);

  if (state.success) {
    return (
      <p className="mt-8 rounded-lg bg-loyala-green/10 px-4 py-3 text-sm text-loyala-green">
        {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
      )}
      <div>
        <label className="text-sm text-neutral-400">Email</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Envoi...' : 'Envoyer le lien'}
      </Button>
    </form>
  );
}
