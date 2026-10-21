'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WelcomeBanner } from '@/components/clients/welcome-banner';
import { WhatsAppRelaunchButton } from '@/components/clients/whatsapp-relaunch-button';
import { createClientAction, type ClientActionState } from '../_actions/clients';

const initial: ClientActionState = {};

export function NewClientForm({
  whatsappReady = false,
  showWelcome = false,
}: {
  whatsappReady?: boolean;
  showWelcome?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createClientAction, initial);

  return (
    <>
      {showWelcome && !state.success && <WelcomeBanner />}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Nouveau client</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {showWelcome && !state.success
            ? 'Commencez par un client fidèle — vous pourrez le relancer tout de suite.'
            : 'Ajoutez un client à votre CRM'}
        </p>
      </div>
      {state.success ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-4 p-6 text-center">
            <p className="font-semibold text-primary">Client créé avec succès 🎉</p>
            <p className="text-sm text-muted-foreground">
              {whatsappReady
                ? 'Relancez-le maintenant sur WhatsApp pour voir la valeur immédiatement.'
                : 'Le client est enregistré. Connectez WhatsApp Business pour le relancer en un clic.'}
            </p>
            {state.optInWhatsapp && state.clientId && state.clientPhone && state.clientName && (
              <WhatsAppRelaunchButton
                clientId={state.clientId}
                phone={state.clientPhone}
                clientName={state.clientName}
                whatsappReady={whatsappReady}
                size="default"
                align="center"
              />
            )}
            <Button className="mt-2" variant="outline" asChild>
              <Link href="/clients">Voir tous mes clients</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
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
            <label className="text-sm text-muted-foreground">Date de naissance</label>
            <input
              name="dateOfBirth"
              type="date"
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Active les campagnes anniversaire automatiques.
            </p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Notes</label>
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input name="optInWhatsapp" type="checkbox" className="mt-0.5 rounded" />
            Le client accepte de recevoir des messages WhatsApp du restaurant
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
      )}
    </>
  );
}
