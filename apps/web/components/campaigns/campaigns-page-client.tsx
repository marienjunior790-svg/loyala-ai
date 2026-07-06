'use client';

import { useActionState } from 'react';
import { Sparkles, Cake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WorkerIntegrationStatus } from '@/components/worker/worker-integration-status';
import {
  generateInactiveCampaignAction,
  generateBirthdayCampaignAction,
  type ModuleActionState,
} from '@/app/(dashboard)/_actions/modules';
import type { Campaign } from '@loyala/domain-crm';
import type { WorkerHealth } from '@/lib/worker/client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardHeader, CardTitle } from '@/components/ui/card';

const initial: ModuleActionState = {};

interface CampaignsPageClientProps {
  campaigns: Campaign[];
  workerHealth: WorkerHealth;
  organizationId: string;
  error?: string | null;
}

export function CampaignsPageClient({
  campaigns,
  workerHealth,
  organizationId,
  error,
}: CampaignsPageClientProps) {
  const [inactiveState, inactiveAction, inactivePending] = useActionState(
    generateInactiveCampaignAction,
    initial
  );
  const [birthdayState, birthdayAction, birthdayPending] = useActionState(
    generateBirthdayCampaignAction,
    initial
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <WorkerIntegrationStatus health={workerHealth} organizationId={organizationId} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Relance inactifs — IA + WhatsApp</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Messages personnalisés pour clients inactifs (30+ jours). Envoi via Relances.
            </p>
            <form action={inactiveAction}>
              <Button type="submit" disabled={inactivePending}>
                {inactivePending ? 'Génération...' : 'Générer relances inactifs'}
              </Button>
            </form>
            {inactiveState.error && <p className="text-sm text-destructive">{inactiveState.error}</p>}
            {inactiveState.success && (
              <p className="text-sm text-emerald-400">{inactiveState.success}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Cake className="h-4 w-4" />
              <span className="text-sm font-medium">Anniversaires du jour</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Campagne automatique (cron 08h UTC) ou déclenchement manuel ici.
            </p>
            <form action={birthdayAction}>
              <Button type="submit" variant="outline" disabled={birthdayPending}>
                {birthdayPending ? 'Génération...' : 'Générer anniversaires'}
              </Button>
            </form>
            {birthdayState.error && <p className="text-sm text-destructive">{birthdayState.error}</p>}
            {birthdayState.success && (
              <p className="text-sm text-emerald-400">{birthdayState.success}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Historique campagnes</h3>
        <Button variant="outline" size="sm" asChild>
          <Link href="/relances">
            Voir relances
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune campagne pour le moment. Générez votre première relance ci-dessus.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <Badge variant="secondary">{c.type}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>
                  {c.target_count} destinataires · {c.status}
                </p>
                {c.message_preview && <p className="mt-2 line-clamp-2">{c.message_preview}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
