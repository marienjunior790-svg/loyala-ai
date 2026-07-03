'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createClientAction, type ClientActionState } from '../_actions/clients';

const initial: ClientActionState = {};

export function NewClientForm() {
  const [state, formAction, pending] = useActionState(createClientAction, initial);

  if (state.success) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 text-center">
          <p className="font-semibold text-primary">Client créé avec succès</p>
          <Button className="mt-4" variant="outline" asChild>
            <Link href="/clients">Retour à la liste</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form action={formAction} className="space-y-4">
          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div>
            <label className="text-sm text-muted-foreground">Nom complet *</label>
            <input
              name="fullName"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Téléphone *</label>
            <input
              name="phone"
              required
              placeholder="+221..."
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Notes</label>
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="optInWhatsapp" type="checkbox" defaultChecked className="rounded" />
            Opt-in WhatsApp
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/clients">Annuler</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
