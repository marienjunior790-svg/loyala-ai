import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Créer un compte</h1>
      <p className="mt-1 text-sm text-muted-foreground">Rejoignez Loyala AI</p>
      <SignupForm />
    </div>
  );
}
