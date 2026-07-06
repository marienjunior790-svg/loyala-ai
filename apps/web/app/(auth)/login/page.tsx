import { LoginForm } from './login-form';

const AUTH_CALLBACK_MESSAGES: Record<string, string> = {
  auth_callback: 'Lien expiré ou invalide. Demandez un nouveau lien ou reconnectez-vous.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const callbackError = error ? AUTH_CALLBACK_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <span className="text-sm font-bold text-primary">L</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Loyala AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connexion à votre CRM</p>
        {callbackError && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {callbackError}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
