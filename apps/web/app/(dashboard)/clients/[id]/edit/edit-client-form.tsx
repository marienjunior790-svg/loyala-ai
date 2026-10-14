'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Client } from '@loyala/domain-crm';
import { updateClientAction, type ClientActionState } from '../../_actions/clients';

const initial: ClientActionState = {};

const inputClass =
  'mt-1 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring';

export function EditClientForm({ client }: { client: Client }) {
  const boundAction = updateClientAction.bind(null, client.id);
  const [state, formAction, pending] = useActionState(boundAction, initial);

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
            <input name="fullName" required defaultValue={client.full_name} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Téléphone *</label>
            <input name="phone" required defaultValue={client.phone} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={client.email ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Date de naissance</label>
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={client.date_of_birth ?? ''}
              className={inputClass}
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
              defaultValue={client.notes ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Messages WhatsApp</label>
            <select name="whatsappConsent" defaultValue={client.whatsapp_consent} className={inputClass}>
              <option value="accorde">Le client a donné son accord</option>
              <option value="a_confirmer">Consentement à confirmer</option>
              <option value="refuse">Pas d’accord</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {client.whatsapp_consent_at
                ? `Dernière mise à jour le ${new Date(client.whatsapp_consent_at).toLocaleDateString('fr-FR')}. `
                : ''}
              Chaque changement est daté et conservé.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/clients/${client.id}`}>Annuler</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
