'use client';

import { useState } from 'react';
import { ShoppingBag, CalendarDays } from 'lucide-react';
import type { ClientVisitWithItems } from '@loyala/domain-crm';
import { ClientVisitsHistory } from '@/components/clients/client-visits-history';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

interface ClientHistorySectionProps {
  clientId: string;
  visits: ClientVisitWithItems[];
  canWrite: boolean;
  currentUserId: string;
}

export function ClientHistorySection({
  clientId,
  visits,
  canWrite,
  currentUserId,
}: ClientHistorySectionProps) {
  const [tab, setTab] = useState<'visits' | 'purchases'>('visits');

  const purchases = visits.filter((v) => v.items.length > 0 || Number(v.amount ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setTab('visits')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === 'visits'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Visites
        </button>
        <button
          type="button"
          onClick={() => setTab('purchases')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === 'purchases'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Historique des achats
        </button>
      </div>

      {tab === 'visits' ? (
        <ClientVisitsHistory
          clientId={clientId}
          visits={visits}
          canWrite={canWrite}
          currentUserId={currentUserId}
        />
      ) : purchases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun achat enregistré. Ajoutez des articles lors de l'enregistrement d'une visite.
        </p>
      ) : (
        <div className="space-y-3">
          {purchases.map((visit) => (
            <div key={visit.id} className="rounded-lg border border-border/60 bg-card/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{formatDate(visit.visited_at)}</p>
                <p className="text-base font-bold text-primary">
                  {formatMoney(Number(visit.amount ?? 0))}
                </p>
              </div>

              {visit.items.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-3">
                  {visit.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.name} <span className="text-foreground">×{Number(item.quantity)}</span>
                        {item.category_name && (
                          <span className="text-xs text-muted-foreground"> · {item.category_name}</span>
                        )}
                      </span>
                      <span>{formatMoney(Number(item.line_total))}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Montant sans détail d'articles.</p>
              )}

              {visit.notes && (
                <p className="mt-3 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                  « {visit.notes} »
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {visit.created_by === currentUserId
                  ? 'Enregistré par vous'
                  : "Enregistré par un membre de l'équipe"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
