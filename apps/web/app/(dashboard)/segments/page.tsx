import Link from 'next/link';
import { Package, Tags } from 'lucide-react';
import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getSegmentBreakdown } from '@/lib/dashboard/charts';
import { getAffinitySegments } from '@loyala/domain-crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  let affinity: Awaited<ReturnType<typeof getAffinitySegments>> = {
    products: [],
    categories: [],
    totalClients: 0,
  };
  let error: string | null = null;

  try {
    [breakdown, affinity] = await Promise.all([
      getSegmentBreakdown(supabase, ctx.organizationId),
      getAffinitySegments(supabase, ctx.organizationId),
    ]);
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
            Répartition calculée automatiquement (seuil inactivité 14 jours)
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

      {(affinity.products.length > 0 || affinity.categories.length > 0) && (
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Segments par affinité</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Clients regroupés par produit et catégorie préférés (calculé depuis l'historique d'achat)
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AffinityCard
              title="Affinité produit"
              icon={<Package className="h-4 w-4" />}
              rows={affinity.products}
              totalClients={affinity.totalClients}
            />
            <AffinityCard
              title="Affinité catégorie"
              icon={<Tags className="h-4 w-4" />}
              rows={affinity.categories}
              totalClients={affinity.totalClients}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AffinityCard({
  title,
  icon,
  rows,
  totalClients,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { name: string; clientCount: number }[];
  totalClients: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore de données d'achat.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const share = totalClients > 0 ? Math.round((row.clientCount / totalClients) * 100) : 0;
              return (
                <li key={row.name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">{row.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{share}%</span>
                    <Badge variant="secondary">
                      {row.clientCount} client{row.clientCount > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
