'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Landmark, Lock, MessageCircle, Smartphone, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  startCheckoutAction,
  type CheckoutActionState,
} from '@/app/(dashboard)/billing/_actions/checkout';
import { startCardCheckoutAction } from '@/app/(dashboard)/billing/_actions/stripe';
import { PAYMENT_METHODS, type PaymentMethodId } from '@/lib/billing/payment-methods';
import { cn } from '@/lib/utils';

const initial: CheckoutActionState = {};

const METHOD_ICONS: Record<PaymentMethodId, typeof Smartphone> = {
  mobile_money: Smartphone,
  card: CreditCard,
  paypal: Wallet,
  bank_transfer: Landmark,
};

export interface BankTransferDetails {
  holder: string | null;
  iban: string | null;
  bic: string | null;
  bank: string | null;
  reference: string;
  whatsappUrl: string;
}

export function CheckoutForm({
  planCode,
  planName,
  amountEur,
  amountFcfa,
  liveMethods,
  bankTransfer,
}: {
  planCode: 'growth' | 'pro';
  planName: string;
  amountEur: string;
  amountFcfa: string;
  liveMethods: PaymentMethodId[];
  bankTransfer: BankTransferDetails;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(startCheckoutAction, initial);
  const [cardState, cardAction, cardPending] = useActionState(startCardCheckoutAction, initial);
  const [method, setMethod] = useState<PaymentMethodId>(
    liveMethods.includes('card') ? 'card' : 'mobile_money'
  );
  const live = liveMethods.includes(method);

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state.redirectTo, router]);

  useEffect(() => {
    const target = cardState.redirectTo;
    if (!target) return;
    if (target.startsWith('http')) window.location.assign(target);
    else router.push(target);
  }, [cardState.redirectTo, router]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Plan <strong className="text-foreground">{planName}</strong> — {amountEur} / mois, sans
        engagement.
      </p>

      <fieldset>
        <legend className="text-sm text-muted-foreground">Mode de paiement</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PAYMENT_METHODS.map((m) => {
            const Icon = METHOD_ICONS[m.id];
            const selected = method === m.id;
            const available = liveMethods.includes(m.id);
            return (
              <label
                key={m.id}
                className={cn(
                  'relative flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition-colors',
                  selected
                    ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border/70 hover:border-primary/30'
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.id}
                  checked={selected}
                  onChange={() => setMethod(m.id)}
                  className="sr-only"
                />
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', selected && 'text-primary')} />
                <span className="min-w-0">
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.detail}</span>
                </span>
                {!available && (
                  <span className="absolute right-2 top-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                    Bientôt
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {method === 'mobile_money' && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="planCode" value={planCode} />
          <p className="text-xs text-muted-foreground">
            Montant débité sur votre compte Mobile Money : {amountFcfa}.
          </p>
          <div>
            <label htmlFor="phone" className="text-sm text-muted-foreground">
              Téléphone Mobile Money (+242)
            </label>
            <Input
              id="phone"
              name="phone"
              required
              placeholder="24206XXXXXXX"
              className="mt-1"
              autoComplete="tel"
            />
          </div>
          <div>
            <label htmlFor="providerNetwork" className="text-sm text-muted-foreground">
              Opérateur
            </label>
            <select
              id="providerNetwork"
              name="providerNetwork"
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-transparent px-3 text-sm"
              defaultValue="MTN"
            >
              <option value="MTN">MTN</option>
              <option value="AIRTEL">Airtel</option>
            </select>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Initiation…' : `Payer ${amountEur}`}
          </Button>
        </form>
      )}

      {method === 'card' && live && (
        <form action={cardAction} className="space-y-4">
          <input type="hidden" name="planCode" value={planCode} />
          <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Vous allez être redirigé vers la page de paiement sécurisée Stripe : carte Visa ou
            Mastercard, Apple Pay ou Google Pay. Prélèvement de {amountEur} chaque mois, résiliable
            à tout moment depuis votre espace.
          </p>
          {cardState.error && <p className="text-sm text-destructive">{cardState.error}</p>}
          {cardState.success && <p className="text-sm text-emerald-400">{cardState.success}</p>}
          <Button type="submit" disabled={cardPending} className="w-full">
            {cardPending ? 'Redirection…' : `Payer ${amountEur} par carte`}
          </Button>
        </form>
      )}

      {((method === 'card' && !live) || method === 'paypal') && (
        <div className="space-y-4">
          <p className="rounded-lg border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
            {live
              ? 'Vous allez être redirigé vers une page de paiement sécurisée.'
              : `Le paiement par ${method === 'card' ? 'carte bancaire, Apple Pay et Google Pay' : 'PayPal'} arrive très bientôt. En attendant, choisissez Mobile Money ou le virement bancaire.`}
          </p>
          <Button className="w-full" disabled>
            {method === 'card' ? 'Payer par carte' : 'Payer avec PayPal'} — {amountEur}
          </Button>
        </div>
      )}

      {method === 'bank_transfer' && (
        <div className="space-y-4">
          <dl className="space-y-2 rounded-lg border border-border/70 bg-background/40 p-4 text-sm">
            <BankRow label="Montant" value={`${amountEur} / mois`} />
            <BankRow label="Référence à indiquer" value={bankTransfer.reference} mono />
            {bankTransfer.holder && <BankRow label="Titulaire" value={bankTransfer.holder} />}
            {bankTransfer.bank && <BankRow label="Banque" value={bankTransfer.bank} />}
            {bankTransfer.iban && <BankRow label="IBAN" value={bankTransfer.iban} mono />}
            {bankTransfer.bic && <BankRow label="BIC / SWIFT" value={bankTransfer.bic} mono />}
          </dl>
          <p className="text-xs text-muted-foreground">
            {bankTransfer.iban
              ? 'Une fois le virement effectué, envoyez-nous la preuve sur WhatsApp : votre abonnement est activé sous 24 h ouvrées.'
              : 'Demandez nos coordonnées bancaires sur WhatsApp en indiquant la référence ci-dessus : votre abonnement est activé dès réception du virement.'}
          </p>
          <Button asChild className="w-full">
            <a href={bankTransfer.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1 h-4 w-4" />
              {bankTransfer.iban ? 'Envoyer la preuve de virement' : 'Obtenir les coordonnées bancaires'}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function BankRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium', mono && 'font-mono text-xs sm:text-sm')}>{value}</dd>
    </div>
  );
}
