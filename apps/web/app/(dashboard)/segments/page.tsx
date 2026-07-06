import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getSegmentBreakdown } from '@/lib/dashboard/charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SyncSegmentsButton } from '@/components/segments/sync-segments-button';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

const SEGMENT_LABELS: Record<string, string> = {
  new: 'Nouveaux',
  regular: 'Réguliers',
  vip: 'VIP',
  inactive: 'Inactifs',
  at_risk: 'À risque',
};

export default async function SegmentsPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  let breakdown: Awaited<ReturnType<typeof getSegmentBreakdown>> = [];
  let error: string | null = null;

  try {
    breakdown = await getSegmentBreakdown(supabase, ctx.organizationId);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Impossible de charger les segments';
  }

  const total = breakdown.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Segments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Répartition calculée automatiquement (seuil inactivité 30 jours)
          </p>
        </div>
        <SyncSegmentsButton />
      </div>

      {error && <ModuleError message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {breakdown.map(({ segment, count }) => (
          <Card key={segment}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base capitalize">
                {SEGMENT_LABELS[segment] ?? segment}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{count}</p>
              <p className="text-xs text-muted-foreground">
                {total > 0 ? Math.round((count / total) * 100) : 0}% du fichier
              </p>
              <Button variant="ghost" className="mt-2 h-auto p-0" asChild>
                <Link href={`/clients?segment=${segment}`}>Voir clients</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {breakdown.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun client —{' '}
            <Link href="/clients/ajouter" className="text-primary underline">
              ajoutez votre premier contact
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
