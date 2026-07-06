'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { reportError } from '@/lib/monitoring/error-report';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { source: 'dashboard-error', digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-md border-destructive/30">
        <CardContent className="space-y-4 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">Erreur du module</h2>
          <p className="text-sm text-muted-foreground">
            Impossible d&apos;afficher cette section. Réessayez ou retournez au tableau de bord.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" onClick={() => reset()}>
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Tableau de bord</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
