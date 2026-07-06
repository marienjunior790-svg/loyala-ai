import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkerHealth } from '@/lib/worker/client';

interface WorkerIntegrationStatusProps {
  health: WorkerHealth;
  organizationId: string;
}

export function WorkerIntegrationStatus({ health, organizationId }: WorkerIntegrationStatusProps) {
  const statusLabel = !health.configured
    ? 'Non configuré'
    : health.reachable
      ? 'Connecté'
      : 'Injoignable';

  const variant = !health.configured
    ? 'secondary'
    : health.reachable
      ? 'success'
      : 'destructive';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Intégration Worker IA</CardTitle>
        <Badge variant={variant}>{statusLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Organisation : <span className="font-mono text-xs text-foreground">{organizationId}</span>
        </p>
        {health.configured && (
          <>
            {health.service && <p>Service : {health.service}</p>}
            {health.inngest !== undefined && (
              <p>Inngest : {health.inngest ? 'configuré' : 'non configuré'}</p>
            )}
            {health.latencyMs !== undefined && <p>Latence : {health.latencyMs} ms</p>}
          </>
        )}
        {health.error && <p className="text-destructive">{health.error}</p>}
        {!health.configured && (
          <p>
            Définissez <code className="text-xs">WORKER_URL</code> et{' '}
            <code className="text-xs">WORKER_API_SECRET</code> sur Vercel pour activer les
            campagnes automatiques.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
