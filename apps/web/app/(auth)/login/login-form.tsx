'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@loyala/ui';
import { loginAction, type AuthActionState } from '../_actions/auth';

const initial: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

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
          placeholder="contact@restaurant.sn"
        />
      </div>
      <div>
        <label className="text-sm text-neutral-400">Mot de passe</label>
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3"
        />
        <Link href="/forgot-password" className="mt-1 block text-right text-xs text-loyala-green">
          Mot de passe oublié ?
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Connexion...' : 'Se connecter'}
      </Button>
      <p className="text-center text-sm text-neutral-400">
        Pas de compte ?{' '}
        <Link href="/signup" className="text-loyala-green">
          S&apos;inscrire
        </Link>
      </p>
    </form>
  );
}
