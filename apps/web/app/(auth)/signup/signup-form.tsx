'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signupAction, type AuthActionState } from '../_actions/auth';

const initial: AuthActionState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initial);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      {state.error && (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {state.success}
        </p>
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
      <div>
        <label className="text-sm text-muted-foreground">Mot de passe (min. 8)</label>
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Création...' : 'Créer mon compte'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Déjà inscrit ?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Connexion
        </Link>
      </p>
    </form>
  );
}
