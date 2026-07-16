'use client';

import { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type {
  ClientTimelineEvent,
  ClientTimelineCategory,
} from '@loyala/domain-crm';
import { CLIENT_TIMELINE_CATEGORY_META } from '@loyala/domain-crm';
import { Badge } from '@/components/ui/badge';

const FILTER_ORDER: ClientTimelineCategory[] = [
  'communication',
  'purchase',
  'loyalty',
  'marketing',
  'review',
  'ai',
  'staff',
  'notes',
  'lifecycle',
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Il y a ${months} mois`;
  return `Il y a ${Math.floor(months / 12)} an(s)`;
}

const DETAIL_LABELS: Record<string, string> = {
  kind: 'Type',
  amount: 'Montant',
  notes: 'Commentaire',
  visitedAt: 'Date',
  channel: 'Canal',
  direction: 'Sens',
  phone: 'Téléphone',
  template: 'Modèle',
  body: 'Message',
  status: 'Statut',
  sentAt: 'Envoyé le',
  deliveredAt: 'Distribué le',
  readAt: 'Lu le',
  error: 'Erreur',
  whatsappUrl: 'Lien WhatsApp',
  pointsDelta: 'Points',
  reason: 'Motif',
  rating: 'Note',
  author: 'Auteur',
  content: 'Contenu',
  url: 'Lien',
  response: 'Réponse',
  respondedAt: 'Répondu le',
  eventType: 'Événement',
  fullName: 'Nom',
  createdAt: 'Créé le',
  payload: 'Données',
  metadata: 'Métadonnées',
};

function renderDetailValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

interface ClientHistoryTimelineProps {
  events: ClientTimelineEvent[];
}

export function ClientHistoryTimeline({ events }: ClientHistoryTimelineProps) {
  const [active, setActive] = useState<ClientTimelineCategory | 'all'>('all');
  const [selected, setSelected] = useState<ClientTimelineEvent | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const availableCategories = useMemo(() => {
    const present = new Set(events.map((e) => e.category));
    return FILTER_ORDER.filter((c) => present.has(c));
  }, [events]);

  const counts = useMemo(() => {
    const map = new Map<ClientTimelineCategory, number>();
    for (const e of events) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return map;
  }, [events]);

  const filtered = useMemo(
    () => (active === 'all' ? events : events.filter((e) => e.category === active)),
    [events, active]
  );

  function openDetails(event: ClientTimelineEvent) {
    setSelected(event);
    dialogRef.current?.showModal();
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun événement pour ce client pour le moment. Les visites, messages, relances,
        points de fidélité, avis et actions de l&apos;IA apparaîtront ici automatiquement.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Tout"
          icon="🗂️"
          count={events.length}
          active={active === 'all'}
          onClick={() => setActive('all')}
        />
        {availableCategories.map((category) => (
          <FilterChip
            key={category}
            label={CLIENT_TIMELINE_CATEGORY_META[category].label}
            icon={CLIENT_TIMELINE_CATEGORY_META[category].icon}
            count={counts.get(category) ?? 0}
            active={active === category}
            onClick={() => setActive(category)}
          />
        ))}
      </div>

      <ol className="relative space-y-3 border-l border-border/60 pl-6">
        {filtered.map((event) => (
          <li key={event.id} className="relative">
            <span
              className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs"
              aria-hidden
            >
              {event.icon}
            </span>
            <button
              type="button"
              onClick={() => openDetails(event)}
              className="w-full rounded-lg border border-border/60 bg-card/40 p-4 text-left transition hover:border-border hover:bg-card/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{event.title}</p>
                <span className="text-xs text-muted-foreground" title={formatDateTime(event.timestamp)}>
                  {formatRelative(event.timestamp)}
                </span>
              </div>
              {event.summary && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{event.summary}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {CLIENT_TIMELINE_CATEGORY_META[event.category].label}
                </Badge>
                {event.actor && (
                  <span className="text-[11px] text-muted-foreground">{event.actor}</span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ol>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun événement dans cette catégorie.</p>
      )}

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100%,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 open:animate-fade-in"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="flex max-h-[80vh] flex-col">
            <div className="flex items-start justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {selected.icon}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{selected.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(selected.timestamp)}
                    {selected.actor ? ` · ${selected.actor}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => dialogRef.current?.close()}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-6 py-5">
              {Object.entries(selected.details)
                .filter(([, value]) => value != null && value !== '')
                .map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {DETAIL_LABELS[key] ?? key}
                    </p>
                    <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm">
                      {renderDetailValue(value)}
                    </pre>
                  </div>
                ))}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  icon: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, icon, count, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border bg-card/40 text-muted-foreground hover:border-border hover:text-foreground'
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
      <span className={active ? 'text-primary' : 'text-muted-foreground/70'}>{count}</span>
    </button>
  );
}
