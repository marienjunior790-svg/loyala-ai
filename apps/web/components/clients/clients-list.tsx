'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import type { Client } from '@loyala/domain-crm';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WhatsAppRelaunchButton } from './whatsapp-relaunch-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'active' | 'inactive';

const INACTIVE = new Set(['inactive', 'at_risk']);

interface ClientsListProps {
  clients: Client[];
  canWrite: boolean;
}

export function ClientsList({ clients, canWrite }: ClientsListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      const isInactive = INACTIVE.has(c.segment);
      if (filter === 'active' && isInactive) return false;
      if (filter === 'inactive' && !isInactive) return false;
      if (!q) return true;
      return (
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [clients, query, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'active', label: 'Actifs' },
    { id: 'inactive', label: 'À relancer' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
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
                <Link href="/clients?nouveau=1">
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
            const isInactive = INACTIVE.has(client.segment);
            return (
              <Card
                key={client.id}
                className="transition-all hover:border-primary/30 hover:shadow-glow"
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <Link href={`/clients/${client.id}`} className="min-w-0 flex-1">
                    <p className="font-medium">{client.full_name}</p>
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isInactive ? 'warning' : 'secondary'}
                      className="capitalize"
                    >
                      {isInactive ? 'à relancer' : client.segment}
                    </Badge>
                    {canWrite && client.opt_in_whatsapp && (
                      <WhatsAppRelaunchButton
                        phone={client.phone}
                        clientName={client.full_name}
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
