'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recordVisitAction, type VisitActionState } from '@/app/(dashboard)/clients/_actions/visits';

const initial: VisitActionState = {};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RecordVisitDialogProps {
  clientId: string;
  clientName: string;
}

export function RecordVisitDialog({ clientId, clientName }: RecordVisitDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(recordVisitAction, initial);

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <>
      <Button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="shadow-glow"
      >
        <CalendarPlus className="h-4 w-4" />
        Enregistrer une visite
      </Button>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 open:animate-fade-in"
        onClose={() => {
          if (!pending) {
            /* reset handled by remount on refresh */
          }
        }}
      >
        <form action={formAction} className="flex flex-col">
          <div className="flex items-start justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Nouvelle visite</p>
              <h3 className="mt-1 text-lg font-semibold">{clientName}</h3>
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

          <div className="space-y-4 px-6 py-5">
            <input type="hidden" name="clientId" value={clientId} />

            <div>
              <label htmlFor="visitedAt" className="text-sm text-muted-foreground">
                Date
              </label>
              <Input
                id="visitedAt"
                name="visitedAt"
                type="date"
                required
                defaultValue={todayInputValue()}
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="amount" className="text-sm text-muted-foreground">
                Montant (XOF, facultatif)
              </label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0}
                step={1}
                placeholder="Ex. 15000"
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="notes" className="text-sm text-muted-foreground">
                Commentaire
              </label>
              <Input
                id="notes"
                name="notes"
                placeholder="Table terrasse, menu déjeuner..."
                className="mt-1"
              />
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
          </div>

          <div className="flex gap-2 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? 'Enregistrement...' : 'Valider'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
