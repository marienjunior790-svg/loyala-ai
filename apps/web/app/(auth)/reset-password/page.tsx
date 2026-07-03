import Link from 'next/link';
import { ResetPasswordForm } from './reset-password-form';

export default function ResetPasswordPage() {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm text-neutral-400">Choisissez un nouveau mot de passe sécurisé.</p>
      <ResetPasswordForm />
      <p className="mt-6 text-sm text-neutral-400">
        <Link href="/login" className="text-loyala-green">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
