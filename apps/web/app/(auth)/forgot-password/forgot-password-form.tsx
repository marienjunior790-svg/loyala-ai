'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPasswordAction, type AuthActionState } from '../_actions/auth';

const initial: AuthActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initial);

  if (state.success) {
    return (
      <p className="mt-8 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
        {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      {state.error && (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}
      <div>
        <label className="text-sm text-muted-foreground">Email</label>
        <Input
          name="email"
          type="email"
          required
          className="mt-1"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Envoi...' : 'Envoyer le lien'}
      </Button>
    </form>
  );
}
