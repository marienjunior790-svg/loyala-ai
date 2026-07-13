'use client';

import { useState } from 'react';
import { Check, MessageCircle, Store, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { completeOnboardingAction, type OnboardingState } from './_actions/onboarding';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import { COUNTRY_OPTIONS, getCountryOption } from '@/lib/countries';

const initial: OnboardingState = {};

const STEPS = [
  { id: 1, label: 'Restaurant', icon: Store },
  { id: 2, label: 'WhatsApp', icon: MessageCircle },
  { id: 3, label: 'Lancement', icon: Users },
] as const;

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    organizationName: '',
    countryCode: 'CG',
    timezone: 'Africa/Brazzaville',
    currency: 'XAF',
    whatsappPhone: '',
  });

  function setCountry(code: string) {
    const country = getCountryOption(code);
    setForm({
      ...form,
      countryCode: code,
      timezone: country?.timezone ?? form.timezone,
      currency: country?.currency ?? form.currency,
    });
  }

  async function handleLaunch() {
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set('organizationName', form.organizationName);
    fd.set('countryCode', form.countryCode);
    fd.set('timezone', form.timezone);
    fd.set('currency', form.currency);
    if (form.whatsappPhone) fd.set('whatsappPhone', form.whatsappPhone);

    const result = await completeOnboardingAction(initial, fd);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-8 flex justify-between gap-2">
        {STEPS.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className={cn(
              'flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 text-center transition',
              step >= id ? 'border-primary/40 bg-primary/5' : 'border-border opacity-50'
            )}
          >
            <Icon className={cn('h-4 w-4', step >= id && 'text-primary')} />
            <span className="text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Nom du restaurant *</label>
            <Input
              className="mt-1"
              required
              minLength={2}
              placeholder="Le Petit Dakar"
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Pays</label>
            <select
              className="mt-1 flex h-11 w-full rounded-lg border border-input bg-background px-4 text-sm"
              value={form.countryCode}
              onChange={(e) => setCountry(e.target.value)}
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
            <p className="mt-1 text-xs text-muted-foreground">
              {form.timezone} · {form.currency}
            </p>
          </div>
          <Button
            className="w-full"
            disabled={form.organizationName.trim().length < 2}
            onClick={() => setStep(2)}
          >
            Continuer
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enregistrez le numéro WhatsApp de votre restaurant. Les relances s&apos;ouvrent dans
            l&apos;application WhatsApp via un lien sécurisé (wa.me).
          </p>
          <div>
            <label className="text-sm text-muted-foreground">Numéro WhatsApp du restaurant</label>
            <Input
              className="mt-1"
              placeholder="06 571 99 22"
              value={form.whatsappPhone}
              onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
            />
          </div>
          {form.whatsappPhone.length > 8 && (
            <Button variant="outline" className="w-full" asChild>
              <a
                href={buildWhatsAppUrl(
                  form.whatsappPhone,
                  'Test Loyala AI — mon restaurant est connecté ✅'
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Tester sur WhatsApp
              </a>
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              Continuer
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Votre CRM sera prêt en quelques secondes. Ajoutez votre premier client juste après.
          </p>
          <Button className="w-full" disabled={pending} onClick={handleLaunch}>
            {pending ? 'Création...' : 'Lancer mon CRM'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setStep(2)}>
            Retour
          </Button>
        </div>
      )}
    </div>
  );
}
