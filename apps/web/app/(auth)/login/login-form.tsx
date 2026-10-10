'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginAction, type AuthActionState } from '../_actions/auth';

const initial: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      {state.error && (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}
      <div>
        <label htmlFor="login-email" className="text-sm text-muted-foreground">
          Email
        </label>
        <Input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1"
          placeholder="contact@restaurant.sn"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="text-sm text-muted-foreground">
          Mot de passe
        </label>
        <Input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1"
        />
        <Link href="/forgot-password" className="mt-1 block text-right text-xs text-primary hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Connexion...' : 'Se connecter'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Pas de compte ?{' '}
        <Link href="/signup" className="text-primary hover:underline">
          S&apos;inscrire
        </Link>
      </p>
    </form>
  );
}
