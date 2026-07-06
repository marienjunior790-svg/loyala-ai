'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WorkerIntegrationStatus } from '@/components/worker/worker-integration-status';
import { generateInactiveCampaignAction, type ModuleActionState } from '@/app/(dashboard)/_actions/modules';
import type { Campaign } from '@loyala/domain-crm';
import type { WorkerHealth } from '@/lib/worker/client';

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
  const [state, action, pending] = useActionState(generateInactiveCampaignAction, initial);

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <WorkerIntegrationStatus health={workerHealth} organizationId={organizationId} />

      <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Campagne inactifs — IA + WhatsApp</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Génère des messages personnalisés pour vos clients inactifs via le worker IA, puis
            envoyez-les depuis la page Relances.
          </p>
          <form action={action}>
            <Button type="submit" disabled={pending}>
              {pending ? 'Génération...' : 'Générer relances inactifs'}
            </Button>
          </form>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
        </CardContent>
      </Card>

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
                <p>{c.target_count} destinataires · {c.status}</p>
                {c.message_preview && <p className="mt-2 line-clamp-2">{c.message_preview}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
