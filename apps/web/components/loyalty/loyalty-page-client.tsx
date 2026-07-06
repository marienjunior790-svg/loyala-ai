'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addPointsAction, type LoyaltyActionState } from '@/app/(dashboard)/loyalty/_actions/loyalty';
import type { Client } from '@loyala/domain-crm';

const initial: LoyaltyActionState = {};

interface LoyaltyPageClientProps {
  summary: { totalPoints: number; clientsWithPoints: number; topClients: { full_name: string; loyalty_points: number }[] };
  clients: Pick<Client, 'id' | 'full_name' | 'loyalty_points'>[];
}

export function LoyaltyPageClient({ summary, clients }: LoyaltyPageClientProps) {
  const [state, formAction, pending] = useActionState(addPointsAction, initial);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Points totaux</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{summary.totalPoints}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clients fidèles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{summary.clientsWithPoints}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top client</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{summary.topClients[0]?.full_name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              {summary.topClients[0]?.loyalty_points ?? 0} pts
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attribuer des points</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Client</label>
              <select
                name="clientId"
                required
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sélectionner...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.loyalty_points} pts)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Points (+ ou -)</label>
              <Input name="points" type="number" required className="mt-1" placeholder="50" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-muted-foreground">Motif</label>
              <Input name="reason" className="mt-1" placeholder="Visite, bonus, correction..." />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement...' : 'Attribuer'}
            </Button>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
