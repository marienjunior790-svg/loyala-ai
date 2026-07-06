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
        <h2 className="text-lg font-semibold text-destructive">Impossible de charger vos clients</h2>
        <p className="text-sm text-muted-foreground">
          Un problème temporaire est survenu. Réessayez dans quelques instants.
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
