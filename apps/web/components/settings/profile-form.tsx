'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  updateProfileAction,
  type SettingsActionState,
} from '@/app/(dashboard)/settings/_actions/settings';

const initial: SettingsActionState = {};

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={action}>
      <Card>
        <CardHeader>
          <CardTitle>Mon profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="profile-full-name" className="text-sm text-muted-foreground">
              Votre nom
            </label>
            <Input
              id="profile-full-name"
              name="fullName"
              defaultValue={fullName}
              placeholder="Ex. Awa Diop"
              maxLength={120}
              autoComplete="name"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Affiché dans l’équipe et en haut du tableau de bord.
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">E-mail de connexion</span>
            <p className="mt-1 text-sm">{email}</p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Enregistrement...' : 'Enregistrer mon profil'}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
        </CardContent>
      </Card>
    </form>
  );
}
