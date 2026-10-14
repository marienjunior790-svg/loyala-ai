import { redirect } from 'next/navigation';
import { getAuthAccess } from '@/lib/auth/session';
import { logoutAction } from '@/app/(auth)/_actions/auth';
import { Button } from '@/components/ui/button';

export default async function AccessDeniedPage() {
  const access = await getAuthAccess();
  if (access.status === 'anonymous') redirect('/login');
  if (access.status === 'no_membership') redirect('/onboarding');
  if (access.status === 'ok') redirect('/dashboard');

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wider text-destructive">Accès refusé</p>
      <h1 className="text-2xl font-semibold tracking-tight">Votre rôle n’est pas reconnu</h1>
      <p className="text-sm text-muted-foreground">
        Vous êtes bien membre de ce restaurant, mais aucun rôle valide ne vous est attribué. Par
        sécurité, aucune donnée n’est accessible tant que le propriétaire ne vous a pas donné un rôle
        (propriétaire, administrateur, gérant, équipe ou lecture seule).
      </p>
      <form action={logoutAction}>
        <Button type="submit" variant="outline" className="w-full">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
