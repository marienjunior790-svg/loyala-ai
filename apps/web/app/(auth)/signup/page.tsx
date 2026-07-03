import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold">Créer un compte</h1>
        <p className="mt-1 text-sm text-neutral-400">Rejoignez Loyala AI</p>
        <SignupForm />
      </div>
    </main>
  );
}
