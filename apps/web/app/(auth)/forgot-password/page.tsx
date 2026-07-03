import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-neutral-400">
        <Link href="/login" className="text-loyala-green">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
