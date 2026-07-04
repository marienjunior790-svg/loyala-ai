'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ClientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-destructive">Erreur page Clients</h2>
        <p className="font-mono text-xs text-muted-foreground">{error.message}</p>
        <p className="text-sm text-muted-foreground">
          Si le message mentionne <code className="text-xs">user_org_ids</code>, exécutez{' '}
          <code className="text-xs">scripts/fix-clients-rls-inline.sql</code> dans Supabase.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => reset()}>
            Réessayer
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard">Retour dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
