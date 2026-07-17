'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, X, Plus, Minus, Trash2, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recordVisitAction, type VisitActionState } from '@/app/(dashboard)/clients/_actions/visits';
import {
  computeItemUnitPrice,
  summarizeSelections,
  defaultSelections,
  validateSelections,
  type OptionGroup,
  type OptionSelections,
} from '@loyala/domain-crm';

const initial: VisitActionState = {};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface CatalogPickerItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  type: 'product' | 'service' | 'rental';
  categoryName: string | null;
  options?: OptionGroup[];
}

interface SaleLine {
  key: string;
  catalogItemId: string | null;
  name: string;
  categoryName: string | null;
  itemType: 'product' | 'service' | 'rental' | null;
  quantity: number;
  unitPrice: number;
}

interface RecordVisitDialogProps {
  clientId: string;
  clientName: string;
  catalogItems: CatalogPickerItem[];
}

function formatMoney(amount: number, currency = 'XOF'): string {
  const label = currency === 'XOF' ? 'FCFA' : currency;
  return `${Math.round(amount).toLocaleString('fr-FR')} ${label}`;
}

export function RecordVisitDialog({ clientId, clientName, catalogItems }: RecordVisitDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(recordVisitAction, initial);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [search, setSearch] = useState('');
  const [configuring, setConfiguring] = useState<{
    item: CatalogPickerItem;
    selections: OptionSelections;
  } | null>(null);

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      setLines([]);
      setSearch('');
      setConfiguring(null);
      router.refresh();
    }
  }, [state.success, router]);

  const currency = catalogItems[0]?.currency ?? 'XOF';
  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    [lines]
  );

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return catalogItems
      .filter((i) => `${i.name} ${i.categoryName ?? ''}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [catalogItems, search]);

  function pushLine(item: CatalogPickerItem, name: string, unitPrice: number, mergeable: boolean) {
    setLines((prev) => {
      if (mergeable) {
        const existing = prev.find((l) => l.catalogItemId === item.id && l.name === name);
        if (existing) {
          return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
        }
      }
      return [
        ...prev,
        {
          key: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          catalogItemId: item.id,
          name,
          categoryName: item.categoryName,
          itemType: item.type,
          quantity: 1,
          unitPrice,
        },
      ];
    });
  }

  function addItem(item: CatalogPickerItem) {
    if (item.options && item.options.length > 0) {
      setConfiguring({ item, selections: defaultSelections(item.options) });
      setSearch('');
      return;
    }
    pushLine(item, item.name, Number(item.price), true);
    setSearch('');
  }

  function confirmConfigured() {
    if (!configuring) return;
    const { item, selections } = configuring;
    const groups = item.options ?? [];
    const err = validateSelections(groups, selections);
    if (err) return;
    const summary = summarizeSelections(groups, selections);
    const name = summary ? `${item.name} (${summary})` : item.name;
    const unitPrice = computeItemUnitPrice(Number(item.price), groups, selections);
    pushLine(item, name, unitPrice, false);
    setConfiguring(null);
  }

  function toggleChoice(group: OptionGroup, choiceId: string) {
    setConfiguring((prev) => {
      if (!prev) return prev;
      const current = prev.selections[group.id] ?? [];
      let next: string[];
      if (group.selection === 'single') {
        next = [choiceId];
      } else {
        next = current.includes(choiceId)
          ? current.filter((id) => id !== choiceId)
          : [...current, choiceId];
      }
      return { ...prev, selections: { ...prev.selections, [group.id]: next } };
    });
  }

  function updateLine(key: string, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const itemsJson = JSON.stringify(
    lines.map((l) => ({
      catalogItemId: l.catalogItemId ?? undefined,
      name: l.name,
      categoryName: l.categoryName ?? undefined,
      itemType: l.itemType ?? undefined,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }))
  );

  return (
    <>
      <Button type="button" onClick={() => dialogRef.current?.showModal()} className="shadow-glow">
        <CalendarPlus className="h-4 w-4" />
        Enregistrer une visite
      </Button>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100%,34rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 open:animate-fade-in"
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
            <input type="hidden" name="itemsJson" value={itemsJson} />

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
              <label className="text-sm text-muted-foreground">Ajouter des produits / services</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher dans le catalogue..."
                  className="pl-9"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addItem(item)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <span className="min-w-0 truncate">
                          {item.name}
                          {item.categoryName && (
                            <span className="text-muted-foreground"> · {item.categoryName}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatMoney(item.price, item.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {catalogItems.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Aucun article actif. Ajoutez des produits/services dans le Catalogue.
                </p>
              )}
            </div>

            {lines.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                {lines.map((line) => (
                  <div key={line.key} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(line.key, { unitPrice: Number(e.target.value) || 0 })
                          }
                          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                        />
                        <span className="text-xs text-muted-foreground">× {line.quantity}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })
                        }
                        className="rounded-md border border-border p-1 hover:bg-secondary"
                        aria-label="Diminuer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="w-12 rounded-md border border-input bg-background px-1 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                        className="rounded-md border border-border p-1 hover:bg-secondary"
                        aria-label="Augmenter"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm font-medium">
                      {formatMoney(line.quantity * line.unitPrice, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                      aria-label="Retirer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm font-semibold">TOTAL</span>
                  <span className="text-base font-bold text-primary">{formatMoney(total, currency)}</span>
                </div>
              </div>
            )}

            {lines.length === 0 && (
              <div>
                <label htmlFor="amount" className="text-sm text-muted-foreground">
                  Montant manuel (XOF, facultatif)
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
            )}

            <div>
              <label htmlFor="notes" className="text-sm text-muted-foreground">
                Commentaire (facultatif)
              </label>
              <Input
                id="notes"
                name="notes"
                placeholder="Client satisfait, table terrasse..."
                className="mt-1"
              />
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
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

        {configuring && (
          <VariantConfigurator
            item={configuring.item}
            selections={configuring.selections}
            onToggle={toggleChoice}
            onCancel={() => setConfiguring(null)}
            onConfirm={confirmConfigured}
          />
        )}
      </dialog>
    </>
  );
}

function VariantConfigurator({
  item,
  selections,
  onToggle,
  onCancel,
  onConfirm,
}: {
  item: CatalogPickerItem;
  selections: OptionSelections;
  onToggle: (group: OptionGroup, choiceId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const groups = item.options ?? [];
  const unitPrice = computeItemUnitPrice(Number(item.price), groups, selections);
  const error = validateSelections(groups, selections);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[85vh] w-[min(100%,26rem)] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
            <h4 className="truncate text-sm font-semibold">{item.name}</h4>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {group.name}
                {group.required && <span className="text-destructive"> *</span>}
                {group.selection === 'multiple' && (
                  <span className="ml-1 font-normal">(plusieurs)</span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.choices.map((choice) => {
                  const active = (selections[group.id] ?? []).includes(choice.id);
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => onToggle(group, choice.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                        active
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {group.kind === 'removable' ? `Sans ${choice.label}` : choice.label}
                      {choice.priceDelta !== 0 && (
                        <span className="ml-1 text-muted-foreground">
                          {choice.priceDelta > 0 ? '+' : ''}
                          {formatMoney(choice.priceDelta, item.currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prix unitaire</span>
            <span className="font-semibold text-primary">{formatMoney(unitPrice, item.currency)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Annuler
            </Button>
            <Button type="button" className="flex-1" disabled={!!error} onClick={onConfirm}>
              {error ?? 'Ajouter'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
