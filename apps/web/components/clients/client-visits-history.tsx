'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Pencil, Undo2 } from 'lucide-react';
import {
  ORDER_STATUS_LABELS,
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  orderNetAmount,
  type ClientVisitWithItems,
} from '@loyala/domain-crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  cancelVisitAction,
  refundVisitAction,
  updateVisitAction,
  type VisitActionState,
} from '@/app/(dashboard)/clients/_actions/visits';
import { isOwnRecentOrder } from '@/lib/auth/clients-access';

const SELECT_CLASS =
  'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmount(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function typeLabel(visit: ClientVisitWithItems): string {
  if (visit.legacy_kind === 'expense') return 'À emporter / livraison';
  return ORDER_TYPE_LABELS[visit.order_type] ?? 'Sur place';
}

const STATUS_STYLE: Record<string, string> = {
  paid: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  partially_refunded: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  refunded: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  cancelled: 'border-destructive/40 text-destructive',
  pending: 'border-border text-muted-foreground',
};

type Mode = 'edit' | 'refund' | 'cancel';

interface ClientVisitsHistoryProps {
  clientId: string;
  visits: ClientVisitWithItems[];
  canWrite: boolean;
  /** Gérant ou plus : modifie ou annule toute commande. */
  canManageOrders: boolean;
  canRefund: boolean;
  currentUserId: string;
}

export function ClientVisitsHistory({
  clientId,
  visits,
  canWrite,
  canManageOrders,
  canRefund,
  currentUserId,
}: ClientVisitsHistoryProps) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<{ id: string; mode: Mode } | null>(null);
  const [result, setResult] = useState<VisitActionState>({});

  function submit(action: (prev: VisitActionState, formData: FormData) => Promise<VisitActionState>, formData: FormData) {
    startTransition(async () => {
      const next = await action({}, formData);
      setResult(next);
      if (next.success) {
        setOpen(null);
        router.refresh();
      }
    });
  }

  if (visits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune commande enregistrée. Utilisez « Enregistrer une commande » pour alimenter le CRM.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {result.success && !open && <p className="text-sm text-emerald-600 dark:text-emerald-400">{result.success}</p>}
      {visits.map((visit) => {
        const mode = open?.id === visit.id ? open.mode : null;
        const status = visit.status ?? 'paid';
        const active = status === 'paid' || status === 'partially_refunded';
        const editable = status === 'paid' && Number(visit.refunded_amount ?? 0) === 0;
        const changeable = canWrite && (canManageOrders || isOwnRecentOrder(visit, currentUserId, now));
        const net = orderNetAmount(visit);
        const refundable = canRefund && net > 0;
        const amount = Number(visit.amount ?? 0);
        const discount = Number(visit.discount_amount ?? 0);
        const refunded = Number(visit.refunded_amount ?? 0);

        return (
          <div
            key={visit.id}
            className="rounded-lg border border-border/60 bg-card/40 p-4 transition hover:border-border"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{formatDate(visit.visited_at)}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {typeLabel(visit)}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[status] ?? ''}`}>
                    {ORDER_STATUS_LABELS[status]}
                  </Badge>
                  {visit.payment_method && (
                    <span className="text-xs text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[visit.payment_method]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {status === 'cancelled' ? (
                    <span className="line-through">{formatAmount(amount)}</span>
                  ) : (
                    <>Montant : {amount > 0 ? formatAmount(net) : '—'}</>
                  )}
                  {discount > 0 && <> · remise {formatAmount(discount)}</>}
                  {refunded > 0 && <> · remboursé {formatAmount(refunded)}</>}
                </p>
                {visit.items.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    {visit.items.map((i) => `${i.name} ×${Number(i.quantity)}`).join(', ')}
                  </p>
                )}
                {status === 'cancelled' && visit.cancel_reason && (
                  <p className="text-sm text-destructive">Motif : {visit.cancel_reason}</p>
                )}
                {visit.notes && <p className="text-sm text-muted-foreground">{visit.notes}</p>}
                <p className="text-xs text-muted-foreground">
                  {visit.source === 'historique'
                    ? 'Reprise de l’ancien historique'
                    : visit.created_by === currentUserId
                      ? 'Enregistré par vous'
                      : 'Enregistré par un membre de l\'équipe'}
                </p>
              </div>
              {canWrite && active && !mode && (changeable || refundable) && (
                <div className="flex gap-1">
                  {editable && changeable && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Modifier la commande"
                      title="Modifier"
                      onClick={() => {
                        setResult({});
                        setOpen({ id: visit.id, mode: 'edit' });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {refundable && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Rembourser"
                      title="Rembourser"
                      onClick={() => {
                        setResult({});
                        setOpen({ id: visit.id, mode: 'refund' });
                      }}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                  {changeable && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label="Annuler la commande"
                      title="Annuler"
                      onClick={() => {
                        setResult({});
                        setOpen({ id: visit.id, mode: 'cancel' });
                      }}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {mode === 'edit' && (
              <form
                className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2"
                action={(formData) => submit(updateVisitAction, formData)}
              >
                <input type="hidden" name="visitId" value={visit.id} />
                <input type="hidden" name="clientId" value={clientId} />
                <div>
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input name="visitedAt" type="date" required defaultValue={toDateInput(visit.visited_at)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select name="orderType" defaultValue={visit.order_type} className={SELECT_CLASS}>
                    {ORDER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ORDER_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Paiement</label>
                  <select name="paymentMethod" defaultValue={visit.payment_method ?? ''} className={SELECT_CLASS}>
                    <option value="">Non renseigné</option>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </select>
                </div>
                {visit.items.length === 0 ? (
                  <div>
                    <label className="text-xs text-muted-foreground">Montant avant remise (FCFA)</label>
                    <Input name="amount" type="number" min={0} defaultValue={Number(visit.subtotal ?? visit.amount ?? 0)} className="mt-1" />
                  </div>
                ) : (
                  <p className="self-end text-xs text-muted-foreground">
                    Le montant suit les articles. Pour changer un article, annulez puis ressaisissez la commande.
                  </p>
                )}
                <div>
                  <label className="text-xs text-muted-foreground">Remise (FCFA)</label>
                  <Input name="discount" type="number" min={0} defaultValue={discount} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground">Commentaire</label>
                  <Input name="notes" defaultValue={visit.notes ?? ''} className="mt-1" />
                </div>
                <FormButtons pending={pending} label="Enregistrer" onCancel={() => setOpen(null)} error={result.error} />
              </form>
            )}

            {mode === 'refund' && (
              <form
                className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2"
                action={(formData) => submit(refundVisitAction, formData)}
              >
                <input type="hidden" name="visitId" value={visit.id} />
                <input type="hidden" name="clientId" value={clientId} />
                <div>
                  <label className="text-xs text-muted-foreground">Montant remboursé (max. {formatAmount(net)})</label>
                  <Input name="amount" type="number" min={1} max={net} required defaultValue={net} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Motif</label>
                  <Input name="reason" required minLength={3} placeholder="Plat non servi, erreur de caisse…" className="mt-1" />
                </div>
                <FormButtons pending={pending} label="Rembourser" onCancel={() => setOpen(null)} error={result.error} />
              </form>
            )}

            {mode === 'cancel' && (
              <form
                className="mt-4 grid gap-3 border-t border-border/60 pt-4"
                action={(formData) => submit(cancelVisitAction, formData)}
              >
                <input type="hidden" name="visitId" value={visit.id} />
                <input type="hidden" name="clientId" value={clientId} />
                <div>
                  <label className="text-xs text-muted-foreground">
                    Motif de l’annulation — la commande reste visible dans l’historique, ses points sont retirés
                  </label>
                  <Input name="reason" required minLength={3} placeholder="Erreur de saisie, doublon…" className="mt-1" />
                </div>
                <FormButtons
                  pending={pending}
                  label="Annuler la commande"
                  destructive
                  onCancel={() => setOpen(null)}
                  error={result.error}
                />
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormButtons({
  pending,
  label,
  destructive,
  onCancel,
  error,
}: {
  pending: boolean;
  label: string;
  destructive?: boolean;
  onCancel: () => void;
  error?: string;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant={destructive ? 'destructive' : 'default'} disabled={pending}>
          {pending ? 'Enregistrement…' : label}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={pending}>
          Fermer
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
