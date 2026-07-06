'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { syncSegmentsAction } from '@/app/(dashboard)/segments/_actions/segments';

export function SyncSegmentsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await syncSegmentsAction();
            setMessage(result.success ?? result.error ?? null);
            if (result.success) router.refresh();
          })
        }
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
        Synchroniser segments + IA
      </Button>
      {message && (
        <span
          className={`text-xs ${message.includes('Erreur') || message.includes('indisponible') ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
