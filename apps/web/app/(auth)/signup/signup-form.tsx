'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@loyala/ui';
import { signupAction, type AuthActionState } from '../_actions/auth';

const initial: AuthActionState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initial);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {state.success}
        </p>
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
      <div>
        <label className="text-sm text-neutral-400">Mot de passe (min. 8)</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Création...' : 'Créer mon compte'}
      </Button>
      <p className="text-center text-sm text-neutral-400">
        Déjà inscrit ?{' '}
        <Link href="/login" className="text-loyala-green">
          Connexion
        </Link>
      </p>
    </form>
  );
}
