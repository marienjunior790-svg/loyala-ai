import { LoginForm } from './login-form';

const AUTH_CALLBACK_MESSAGES: Record<string, string> = {
  auth_callback: 'Lien expiré ou invalide. Demandez un nouveau lien ou reconnectez-vous.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;
  const callbackError = error ? AUTH_CALLBACK_MESSAGES[error] : undefined;

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Bon retour</h1>
      <p className="mt-1 text-sm text-muted-foreground">Connexion à votre CRM</p>
      {reset === 'ok' && (
        <p className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
          Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de passe.
        </p>
      )}
      {callbackError && (
        <p className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-red-300">
          {callbackError}
        </p>
      )}
      <LoginForm />
    </div>
  );
}
