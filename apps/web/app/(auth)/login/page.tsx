import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-4xl">🍽️</p>
        <h1 className="mt-2 text-2xl font-bold">Loyala AI</h1>
        <p className="mt-1 text-sm text-neutral-400">Connexion</p>
        <LoginForm />
      </div>
    </main>
  );
}
