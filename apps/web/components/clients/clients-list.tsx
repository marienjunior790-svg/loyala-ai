'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronRight } from 'lucide-react';
import type { Client, ClientFileStats } from '@loyala/domain-crm';
import { computeClientSegment, isClientInactive } from '@loyala/domain-crm';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WhatsAppRelaunchButton } from './whatsapp-relaunch-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatMoney, formatShortDate } from '@/lib/clients/money';

type Filter = 'all' | 'active' | 'inactive';
type Sort = 'spent' | 'month' | 'loyal' | 'recent' | 'relaunch';

const VALID_SEGMENTS = new Set(['new', 'regular', 'vip', 'inactive', 'at_risk']);

const SEGMENT_LABELS: Record<string, string> = {
  new: 'nouveau',
  regular: 'actif',
  vip: 'VIP',
  inactive: 'habitué perdu',
  at_risk: 'à risque',
};

const SORTS: { id: Sort; label: string }[] = [
  { id: 'spent', label: 'Plus gros dépensiers' },
  { id: 'month', label: 'Dépense du mois' },
  { id: 'loyal', label: 'Plus fidèles' },
  { id: 'recent', label: 'Venus récemment' },
  { id: 'relaunch', label: 'À relancer en premier' },
];

const EMPTY_STATS: ClientFileStats = { monthSpent: 0, averageBasket: 0, favoriteProduct: null, rank: null };

function lastVisitTime(client: Client) {
  return client.last_visit_at ? new Date(client.last_visit_at).getTime() : null;
}

interface ClientsListProps {
  clients: Client[];
  canWrite: boolean;
  initialSegment?: string | null;
  whatsappReady?: boolean;
  stats?: Record<string, ClientFileStats>;
  currency?: string;
  timezone?: string;
}

export function ClientsList({
  clients,
  canWrite,
  initialSegment,
  whatsappReady = false,
  stats = {},
  currency = 'XOF',
  timezone = 'Africa/Dakar',
}: ClientsListProps) {
  const segmentFilter =
    initialSegment && VALID_SEGMENTS.has(initialSegment) ? initialSegment : null;
  const relaunchFirst = segmentFilter === 'inactive' || segmentFilter === 'at_risk';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(relaunchFirst ? 'inactive' : 'all');
  const [sort, setSort] = useState<Sort>(relaunchFirst ? 'relaunch' : 'spent');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = clients.filter((c) => {
      const segment = computeClientSegment(c);
      if (segmentFilter && segment !== segmentFilter) return false;

      const isInactive = isClientInactive(c);
      if (!segmentFilter) {
        if (filter === 'active' && isInactive) return false;
        if (filter === 'inactive' && !isInactive) return false;
      }
      if (!q) return true;
      const qDigits = q.replace(/\D/g, '');
      return (
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (qDigits.length >= 4 &&
          (c.phone.replace(/\D/g, '').includes(qDigits) || (c.phone_e164 ?? '').includes(qDigits))) ||
        (c.email?.toLowerCase().includes(q) ?? false)
      );
    });

    const spent = (c: Client) => Number(c.total_spent ?? 0);
    const byName = (a: Client, b: Client) => a.full_name.localeCompare(b.full_name, 'fr');
    return rows.sort((a, b) => {
      switch (sort) {
        case 'month':
          return (stats[b.id]?.monthSpent ?? 0) - (stats[a.id]?.monthSpent ?? 0) || spent(b) - spent(a) || byName(a, b);
        case 'loyal':
          return (b.visit_count ?? 0) - (a.visit_count ?? 0) || spent(b) - spent(a) || byName(a, b);
        case 'recent':
          return (lastVisitTime(b) ?? -Infinity) - (lastVisitTime(a) ?? -Infinity) || byName(a, b);
        case 'relaunch': {
          const inactive = Number(isClientInactive(b)) - Number(isClientInactive(a));
          if (inactive !== 0) return inactive;
          return (lastVisitTime(a) ?? -Infinity) - (lastVisitTime(b) ?? -Infinity) || spent(b) - spent(a);
        }
        default:
          return spent(b) - spent(a) || (b.visit_count ?? 0) - (a.visit_count ?? 0) || byName(a, b);
      }
    });
  }, [clients, query, filter, segmentFilter, sort, stats]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'active', label: 'Actifs' },
    { id: 'inactive', label: 'À relancer' },
  ];

  return (
    <div className="space-y-4">
      {segmentFilter && (
        <p className="text-sm text-muted-foreground">
          Groupe : <span className="font-medium">{SEGMENT_LABELS[segmentFilter] ?? segmentFilter}</span>
          {' · '}
          <Link href="/clients?vue=fichier" className="text-primary underline">
            Tous les clients
          </Link>
        </p>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Rechercher un client"
            placeholder="Rechercher un client..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Trier les clients"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1 rounded-lg border border-border p-1" role="group" aria-label="Filtrer les clients">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                disabled={Boolean(segmentFilter)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition',
                  filter === f.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {clients.length === 0
                ? 'Aucun client pour le moment.'
                : 'Aucun client ne correspond à votre recherche.'}
            </p>
            {clients.length === 0 && canWrite && (
              <Button className="mt-4" asChild>
                <Link href="/clients/ajouter">
                  <Plus className="h-4 w-4" />
                  Ajouter votre premier client
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((client) => {
            const isInactive = isClientInactive(client);
            const segment = computeClientSegment(client);
            const file = stats[client.id] ?? EMPTY_STATS;
            const figures = [
              { label: 'Total dépensé', value: formatMoney(Number(client.total_spent ?? 0), currency) },
              { label: 'Ce mois', value: file.monthSpent > 0 ? formatMoney(file.monthSpent, currency) : '—' },
              { label: 'Panier moyen', value: file.averageBasket > 0 ? formatMoney(file.averageBasket, currency) : '—' },
              { label: 'Commandes', value: String(client.visit_count ?? 0) },
              { label: 'Plat préféré', value: file.favoriteProduct ?? '—' },
              { label: 'Dernière commande', value: formatShortDate(client.last_visit_at, timezone) },
            ];
            return (
              <Card
                key={client.id}
                className="transition-all hover:border-primary/30 hover:shadow-glow"
              >
                <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 items-center gap-3 lg:w-56 lg:shrink-0">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        file.rank !== null && file.rank <= 3
                          ? 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/40'
                          : 'bg-white/[0.07] text-muted-foreground'
                      )}
                      title={file.rank !== null ? `Rang ${file.rank} par dépense totale` : 'Pas encore de dépense'}
                    >
                      {file.rank !== null ? `#${file.rank}` : '—'}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/clients/${client.id}`} className="block truncate font-medium hover:text-primary">
                        {client.full_name}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">{client.phone}</p>
                    </div>
                  </div>
                  <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
                    {figures.map((figure) => (
                      <div key={figure.label} className="min-w-0">
                        <dt className="text-[11px] text-muted-foreground">{figure.label}</dt>
                        <dd className="truncate text-sm font-medium">{figure.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex items-center gap-2 lg:w-60 lg:shrink-0 lg:justify-end">
                    <Badge variant={isInactive ? 'warning' : segment === 'vip' ? 'default' : 'secondary'}>
                      {isInactive ? 'à relancer' : SEGMENT_LABELS[segment]}
                    </Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/clients/${client.id}`}>
                        Voir
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    {canWrite && client.opt_in_whatsapp && (
                      <WhatsAppRelaunchButton
                        clientId={client.id}
                        phone={client.phone}
                        clientName={client.full_name}
                        whatsappReady={whatsappReady}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
