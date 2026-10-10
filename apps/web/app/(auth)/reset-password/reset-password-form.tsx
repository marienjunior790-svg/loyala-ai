'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPasswordAction, type AuthActionState } from '../_actions/auth';

const initial: AuthActionState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      {state.error && (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}
      <div>
        <label className="text-sm text-muted-foreground">Nouveau mot de passe</label>
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground">Confirmer le mot de passe</label>
        <Input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className="mt-1"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Mise à jour...' : 'Mettre à jour'}
      </Button>
    </form>
  );
}
