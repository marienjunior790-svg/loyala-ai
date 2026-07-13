'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import type { ClientVisit } from '@loyala/domain-crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  deleteVisitAction,
  updateVisitAction,
  type VisitActionState,
} from '@/app/(dashboard)/clients/_actions/visits';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmount(amount: number | null): string {
  if (amount == null || amount === 0) return '—';
  return `${Math.round(amount).toLocaleString('fr-FR')} XOF`;
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

interface ClientVisitsHistoryProps {
  clientId: string;
  visits: ClientVisit[];
  canWrite: boolean;
  currentUserId: string;
}

export function ClientVisitsHistory({
  clientId,
  visits,
  canWrite,
  currentUserId,
}: ClientVisitsHistoryProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<VisitActionState>({});

  if (visits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune visite enregistrée. Utilisez « Enregistrer une visite » pour alimenter le CRM.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visits.map((visit) => {
        const isEditing = editingId === visit.id;

        return (
          <div
            key={visit.id}
            className="rounded-lg border border-border/60 bg-card/40 p-4 transition hover:border-border"
          >
            {isEditing ? (
              <form
                className="grid gap-3 sm:grid-cols-2"
                action={async (formData) => {
                  const result = await updateVisitAction(updateState, formData);
                  setUpdateState(result);
                  if (result.success) {
                    setEditingId(null);
                    router.refresh();
                  }
                }}
              >
                <input type="hidden" name="visitId" value={visit.id} />
                <input type="hidden" name="clientId" value={clientId} />
                <div>
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input
                    name="visitedAt"
                    type="date"
                    required
                    defaultValue={toDateInput(visit.visited_at)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Montant (XOF)</label>
                  <Input
                    name="amount"
                    type="number"
                    min={0}
                    defaultValue={visit.amount ?? ''}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground">Commentaire</label>
                  <Input name="notes" defaultValue={visit.notes ?? ''} className="mt-1" />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" size="sm" disabled={pending}>
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Annuler
                  </Button>
                </div>
                {updateState.error && (
                  <p className="text-sm text-destructive sm:col-span-2">{updateState.error}</p>
                )}
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{formatDate(visit.visited_at)}</p>
                    {visit.kind === 'expense' && (
                      <Badge variant="outline" className="text-[10px]">
                        Dépense
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Montant : {formatAmount(visit.amount != null ? Number(visit.amount) : null)}
                  </p>
                  {visit.notes && (
                    <p className="text-sm text-muted-foreground">{visit.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {visit.created_by === currentUserId
                      ? 'Enregistré par vous'
                      : 'Enregistré par un membre de l\'équipe'}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Modifier la visite"
                      onClick={() => setEditingId(visit.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label="Supprimer la visite"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm('Supprimer cette entrée ? Les totaux seront recalculés.')) return;
                        startTransition(async () => {
                          const result = await deleteVisitAction(clientId, visit.id);
                          if (result.error) alert(result.error);
                          else router.refresh();
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
