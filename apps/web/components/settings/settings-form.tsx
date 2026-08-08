'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  updateOrganizationSettingsAction,
  type SettingsActionState,
} from '@/app/(dashboard)/settings/_actions/settings';
import type { Organization } from '@loyala/domain-crm';
import { COUNTRY_OPTIONS, getCountryOption } from '@/lib/countries';

const initial: SettingsActionState = {};

export function SettingsForm({ org }: { org: Organization }) {
  const [state, action, pending] = useActionState(updateOrganizationSettingsAction, initial);
  const whatsappPhone = String((org.settings as Record<string, unknown>)?.whatsapp_phone ?? '');
  const googleReviewUrl = String(
    (org.settings as Record<string, unknown>)?.google_review_url ?? ''
  );
  const autoRequest =
    (org.settings as Record<string, unknown>)?.google_review_auto_request !== false;
  const [countryCode, setCountryCode] = useState(org.country_code || 'CG');
  const country = useMemo(() => getCountryOption(countryCode), [countryCode]);

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      <Card>
        <CardHeader>
          <CardTitle>Restaurant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Nom du restaurant</label>
            <Input name="name" defaultValue={org.name} required className="mt-1" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Pays</label>
            <select
              name="countryCode"
              className="mt-1 flex h-11 w-full rounded-lg border border-input bg-background px-4 text-sm"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              <optgroup label="Afrique centrale">
                {COUNTRY_OPTIONS.filter((c) => c.region === 'central').map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Afrique de l'Ouest et autres">
                {COUNTRY_OPTIONS.filter((c) => c.region !== 'central').map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <input type="hidden" name="timezone" value={country?.timezone ?? org.timezone} />
            <input type="hidden" name="currency" value={country?.currency ?? org.currency} />
            <p className="mt-1 text-xs text-muted-foreground">
              Fuseau {country?.timezone ?? org.timezone} · Devise {country?.currency ?? org.currency}
            </p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">WhatsApp (affichage / QR — optionnel)</label>
            <Input
              name="whatsappPhone"
              defaultValue={whatsappPhone}
              placeholder="+242065719922"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Pour la connexion Cloud API (envoi / webhook), utilisez la section{' '}
              <strong>WhatsApp Business</strong> ci-dessous. Ne partagez jamais le token d’une autre
              organisation.
            </p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Lien avis Google</label>
            <Input
              name="googleReviewUrl"
              defaultValue={googleReviewUrl}
              placeholder="https://g.page/r/…/review"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lien « Écrire un avis » Google Maps / fiche établissement. Après chaque visite, WhatsApp
              s’ouvre pour demander l’avis au client (s’il a un téléphone + opt-in).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="googleReviewAutoRequest"
              value="1"
              defaultChecked={autoRequest}
              className="rounded border-border"
            />
            Demander automatiquement un avis Google après chaque visite
          </label>
          <div>
            <label className="text-sm text-muted-foreground">Logo (Supabase Storage)</label>
            <Input name="logo" type="file" accept="image/*" className="mt-1" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
        </CardContent>
      </Card>
    </form>
  );
}
