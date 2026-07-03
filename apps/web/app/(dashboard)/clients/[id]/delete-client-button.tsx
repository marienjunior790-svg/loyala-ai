'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteClientAction } from '../_actions/clients';

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-destructive transition hover:text-destructive/80 disabled:opacity-50"
      onClick={() => {
        if (!confirm('Supprimer ce client ?')) return;
        startTransition(async () => {
          const result = await deleteClientAction(clientId);
          if (result.error) alert(result.error);
          else router.push('/clients');
        });
      }}
    >
      {pending ? 'Suppression...' : 'Supprimer'}
    </button>
  );
}
