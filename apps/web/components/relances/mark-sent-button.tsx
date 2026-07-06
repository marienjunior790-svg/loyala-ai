'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { markRelanceSentAction } from '@/app/(dashboard)/_actions/modules';
import { Check } from 'lucide-react';

export function MarkRelanceSentButton({ sendId }: { sendId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await markRelanceSentAction(sendId);
          if (!result.error) router.refresh();
        });
      }}
    >
      <Check className="mr-1 h-3 w-3" />
      Marquer envoyé
    </Button>
  );
}
