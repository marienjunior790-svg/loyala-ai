'use client';

import { useActionState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addPointsAction, type LoyaltyActionState } from '@/app/(dashboard)/loyalty/_actions/loyalty';
import type { Client, LoyaltyTransaction } from '@loyala/domain-crm';
import { LOYALTY_XOF_PER_POINT } from '@loyala/domain-crm';

const initial: LoyaltyActionState = {};

interface LoyaltyPageClientProps {
  summary: {
    totalPoints: number;
    clientsWithPoints: number;
    topClients: { full_name: string; loyalty_points: number }[];
  };
  clients: Pick<Client, 'id' | 'full_name' | 'loyalty_points'>[];
  transactions: LoyaltyTransaction[];
}

export function LoyaltyPageClient({ summary, clients, transactions }: LoyaltyPageClientProps) {
  const [state, formAction, pending] = useActionState(addPointsAction, initial);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Fidélisation automatique active</p>
            <p className="mt-1">
              À chaque visite ou dépense enregistrée :{' '}
              <span className="font-medium text-foreground">
                1 point pour {LOYALTY_XOF_PER_POINT.toLocaleString('fr-FR')} XOF
              </span>{' '}
              dépensés. L’ajustement manuel ci-dessous reste disponible pour les bonus /
              corrections.
            </p>
          </div>
        </div>
      </div>

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
          <CardTitle>Ajustement manuel</CardTitle>
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
              <Input name="reason" className="mt-1" placeholder="Bonus, correction..." />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement...' : 'Attribuer'}
            </Button>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des points</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune transaction pour le moment. Enregistrez une visite avec un montant pour
              créditer automatiquement des points.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {tx.clients?.full_name ?? 'Client'}
                    </p>
                    <p className="text-xs text-muted-foreground">{tx.reason}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <span
                    className={
                      tx.points_delta >= 0
                        ? 'shrink-0 font-semibold text-emerald-400'
                        : 'shrink-0 font-semibold text-amber-400'
                    }
                  >
                    {tx.points_delta >= 0 ? '+' : ''}
                    {tx.points_delta} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
