'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from '@loyala/validation';

export type AuthActionState = { error?: string; success?: string };

function getAuthErrorMessage(error: { message?: string; status?: number }): string {
  const message = error.message?.toLowerCase() ?? '';

  if (message.includes('email not confirmed')) {
    return 'Email non confirmé. Vérifiez votre boîte mail puis réessayez.';
  }

  if (message.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect';
  }

  if (message.includes('email rate limit')) {
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  }

  return error.message ?? 'Connexion impossible pour le moment';
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    console.warn('[auth] signInWithPassword failed', {
      status: error.status,
      message: error.message,
    });
    return { error: getAuthErrorMessage(error) };
  }

  redirect('/dashboard');
}

export async function signupAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) return { error: error.message };

  if (!data.session) {
    return {
      success: 'Compte créé. Vérifiez votre email pour confirmer votre inscription.',
    };
  }

  redirect('/onboarding');
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

async function getSiteOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') ?? 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message };

  return {
    success: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.',
  };
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: error.message };

  redirect('/login');
}
