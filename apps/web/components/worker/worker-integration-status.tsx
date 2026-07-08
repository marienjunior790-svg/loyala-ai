import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AutomationStatus } from '@/lib/worker/automation-status';

interface WorkerIntegrationStatusProps {
  status: AutomationStatus;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Jamais';
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function WorkerIntegrationStatus({ status }: WorkerIntegrationStatusProps) {
  const badgeVariant = !status.workerConfigured
    ? 'secondary'
    : status.workerOnline
      ? 'success'
      : 'destructive';

  const badgeLabel = !status.workerConfigured
    ? 'Non configuré'
    : status.workerOnline
      ? 'Automatisations actives'
      : 'Service indisponible';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Automatisations IA</CardTitle>
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Dernière relance inactifs</p>
          <p className="font-medium text-foreground">{formatWhen(status.lastInactiveRun)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Derniers anniversaires</p>
          <p className="font-medium text-foreground">{formatWhen(status.lastBirthdayRun)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Prochaine exécution auto</p>
          <p className="font-medium text-foreground">{formatWhen(status.nextScheduledRun)}</p>
          <p className="text-xs text-muted-foreground">Cron quotidien 08h UTC</p>
        </div>
        <div>
          <p className="text-muted-foreground">Campagnes IA exécutées</p>
          <p className="font-medium text-foreground">{status.campaignsExecuted}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Relances en attente</p>
          <p className="font-medium text-foreground">{status.relancesPending}</p>
        </div>
        {status.lastError && (
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Dernière erreur</p>
            <p className="text-destructive break-words">{status.lastError}</p>
          </div>
        )}
        {!status.workerConfigured && (
          <p className="text-muted-foreground sm:col-span-2">
            Les automatisations nécessitent la configuration du worker sur Vercel (variables
            WORKER_URL et WORKER_API_SECRET).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
