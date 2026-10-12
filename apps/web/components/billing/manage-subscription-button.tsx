'use client';

import { useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { openBillingPortalAction } from '@/app/(dashboard)/billing/_actions/stripe';
import type { CheckoutActionState } from '@/app/(dashboard)/billing/_actions/checkout';

const initial: CheckoutActionState = {};

export function ManageSubscriptionButton() {
  const [state, action, pending] = useActionState(openBillingPortalAction, initial);

  useEffect(() => {
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [state.redirectTo]);

  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? 'Ouverture…' : 'Gérer ma carte ou résilier'}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
