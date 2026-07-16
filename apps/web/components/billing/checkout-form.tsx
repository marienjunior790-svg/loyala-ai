'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  startCheckoutAction,
  type CheckoutActionState,
} from '@/app/(dashboard)/billing/_actions/checkout';

const initial: CheckoutActionState = {};

export function CheckoutForm({
  planCode,
  planName,
  amountLabel,
}: {
  planCode: 'growth' | 'pro';
  planName: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(startCheckoutAction, initial);

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state.redirectTo, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="planCode" value={planCode} />
      <p className="text-sm text-muted-foreground">
        Plan <strong className="text-foreground">{planName}</strong> — {amountLabel} / mois via
        OpenPay Congo (Mobile Money).
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
        {pending ? 'Initiation…' : 'Payer maintenant'}
      </Button>
    </form>
  );
}
