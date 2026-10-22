'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Plus, Minus, Trash2, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassDialog, GlassDialogBody, GlassDialogFooter } from '@/components/ui/glass-dialog';
import { recordVisitAction, type VisitActionState } from '@/app/(dashboard)/clients/_actions/visits';
import {
  computeItemUnitPrice,
  summarizeSelections,
  defaultSelections,
  validateSelections,
  assessSaleOptions,
  effectiveMax,
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type OptionGroup,
  type OptionSelections,
  type OptionQuantities,
} from '@loyala/domain-crm';

const initial: VisitActionState = {};

const SELECT_CLASS =
  'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring';

function currencyLabel(currency: string): string {
  return currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency;
}

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
  selections?: OptionSelections;
  quantities?: OptionQuantities;
}

interface RecordVisitDialogProps {
  clientId: string;
  clientName: string;
  catalogItems: CatalogPickerItem[];
  /** Fuseau du restaurant, identique au calcul SQL des options. */
  timeZone?: string;
}

function formatMoney(amount: number, currency = 'XOF'): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} ${currencyLabel(currency)}`;
}

export function RecordVisitDialog({
  clientId,
  clientName,
  catalogItems,
  timeZone = 'Africa/Dakar',
}: RecordVisitDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(recordVisitAction, initial);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [submissionKey, setSubmissionKey] = useState('');
  const [saleNotice, setSaleNotice] = useState('');
  const [configuring, setConfiguring] = useState<{
    item: CatalogPickerItem;
    groups: OptionGroup[];
    selections: OptionSelections;
    quantities: OptionQuantities;
  } | null>(null);

  useEffect(() => {
    if (state.success) {
      if (state.reviewWhatsappUrl && !state.alreadyRecorded) {
        window.open(state.reviewWhatsappUrl, '_blank', 'noopener,noreferrer');
      }
      setOpen(false);
      setLines([]);
      setDiscount('');
      setSearch('');
      setCategory('all');
      setSaleNotice('');
      setConfiguring(null);
      router.refresh();
    }
  }, [state.success, state.reviewWhatsappUrl, state.alreadyRecorded, router]);

  const currency = catalogItems[0]?.currency ?? 'XOF';
  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    [lines]
  );
  const discountValue = Math.max(Number(discount) || 0, 0);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const item of catalogItems) names.add(item.categoryName ?? 'Sans catégorie');
    return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [catalogItems]);

  const browseItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = catalogItems.filter((item) => {
      const label = item.categoryName ?? 'Sans catégorie';
      if (term) return `${item.name} ${label}`.toLowerCase().includes(term);
      return category === 'all' || label === category;
    });
    const limit = term || category !== 'all' ? 80 : 12;
    return matched.slice(0, limit);
  }, [catalogItems, search, category]);

  function openSale() {
    if (pending) return;
    setSubmissionKey(crypto.randomUUID());
    setLines([]);
    setDiscount('');
    setSearch('');
    setCategory('all');
    setSaleNotice('');
    setConfiguring(null);
    setOpen(true);
  }

  function pushLine(
    item: CatalogPickerItem,
    name: string,
    unitPrice: number,
    mergeable: boolean,
    selections?: OptionSelections,
    quantities?: OptionQuantities
  ) {
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
          selections,
          quantities,
        },
      ];
    });
  }

  function addItem(item: CatalogPickerItem) {
    const assessed = assessSaleOptions(item.options ?? [], new Date(), timeZone);
    if (!assessed.sellable) {
      setSaleNotice(`Article indisponible : ${item.name}. ${assessed.message}`);
      return;
    }
    setSaleNotice('');
    const groups = assessed.groups;
    if (groups.length > 0) {
      setConfiguring({ item, groups, selections: defaultSelections(groups), quantities: {} });
      setSearch('');
      return;
    }
    pushLine(item, item.name, Number(item.price), true);
    setSearch('');
  }

  function confirmConfigured() {
    if (!configuring) return;
    const { item, groups, selections, quantities } = configuring;
    const err = validateSelections(groups, selections);
    if (err) return;
    const summary = summarizeSelections(groups, selections, quantities);
    const name = summary ? `${item.name} (${summary})` : item.name;
    const unitPrice = computeItemUnitPrice(Number(item.price), groups, selections, quantities);
    pushLine(item, name, unitPrice, false, selections, quantities);
    setConfiguring(null);
  }

  function toggleChoice(group: OptionGroup, choiceId: string) {
    setConfiguring((prev) => {
      if (!prev) return prev;
      const current = prev.selections[group.id] ?? [];
      const max = effectiveMax(group);
      let next: string[];
      if (max <= 1) {
        next = [choiceId];
      } else if (current.includes(choiceId)) {
        next = current.filter((id) => id !== choiceId);
      } else if (current.length >= max) {
        // At max choices: replace the oldest selection with the new one.
        next = [...current.slice(1), choiceId];
      } else {
        next = [...current, choiceId];
      }
      return { ...prev, selections: { ...prev.selections, [group.id]: next } };
    });
  }

  function setChoiceQty(choiceId: string, qty: number) {
    setConfiguring((prev) => {
      if (!prev) return prev;
      return { ...prev, quantities: { ...prev.quantities, [choiceId]: Math.max(1, qty) } };
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
      optionSelections: l.selections,
      optionQuantities: l.quantities,
    }))
  );

  return (
    <>
      <Button type="button" onClick={openSale}>
        <CalendarPlus className="h-4 w-4" />
        Enregistrer une commande
      </Button>

      <GlassDialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        eyebrow="Nouvelle commande"
        title={clientName}
        size="lg"
      >
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <GlassDialogBody className="space-y-4">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="itemsJson" value={itemsJson} />
            <input type="hidden" name="idempotencyKey" value={submissionKey} />

            <div className="grid gap-3 sm:grid-cols-3">
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
                <label htmlFor="orderType" className="text-sm text-muted-foreground">
                  Type
                </label>
                <select id="orderType" name="orderType" defaultValue="sur_place" className={SELECT_CLASS}>
                  {ORDER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ORDER_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="paymentMethod" className="text-sm text-muted-foreground">
                  Paiement
                </label>
                <select id="paymentMethod" name="paymentMethod" required defaultValue="" className={SELECT_CLASS}>
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Ajouter des produits / services</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  placeholder="Rechercher dans le catalogue..."
                  className="h-11 pl-9"
                />
              </div>
              {categories.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setCategory('all')}
                    className={`shrink-0 rounded-full border px-3 py-2 text-sm ${
                      category === 'all' ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    À portée de main
                  </button>
                  {categories.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setCategory(name);
                        setSearch('');
                      }}
                      className={`shrink-0 rounded-full border px-3 py-2 text-sm ${
                        category === name && !search.trim()
                          ? 'border-primary bg-primary/10'
                          : 'border-border'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              {browseItems.length > 0 && (
                <div className="mt-2 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                  {browseItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
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
              {saleNotice && <p className="mt-2 text-sm text-destructive">{saleNotice}</p>}
              {catalogItems.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Aucun article actif. Ajoutez des produits/services dans le Catalogue, ou saisissez un montant global.
                </p>
              )}
            </div>

            {lines.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                {lines.map((line) => (
                  <div key={line.key} className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatMoney(line.unitPrice, currency)} × {line.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border hover:bg-secondary"
                        aria-label="Diminuer"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="h-11 w-14 rounded-md border border-input bg-background text-center text-base outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border hover:bg-secondary"
                        aria-label="Augmenter"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                    <span className="w-28 shrink-0 text-right text-sm font-medium">
                      {formatMoney(line.quantity * line.unitPrice, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                      aria-label="Retirer"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm text-muted-foreground">Sous-total</span>
                  <span className="text-sm font-medium">{formatMoney(total, currency)}</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Remise</span>
                    <span className="text-sm font-medium">− {formatMoney(discountValue, currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">TOTAL PAYÉ</span>
                  <span className="text-base font-bold text-primary">
                    {formatMoney(Math.max(total - discountValue, 0), currency)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {lines.length === 0 && (
                <div>
                  <label htmlFor="amount" className="text-sm text-muted-foreground">
                    Montant global, sans article ({currencyLabel(currency)})
                  </label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min={0}
                    step={1}
                    required
                    placeholder="Ex. 15000"
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <label htmlFor="discount" className="text-sm text-muted-foreground">
                  Remise (facultatif)
                </label>
                <Input
                  id="discount"
                  name="discount"
                  type="number"
                  min={0}
                  step={1}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>

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
          </GlassDialogBody>

          <GlassDialogFooter className="flex-nowrap">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={pending} aria-busy={pending}>
              {pending ? 'Enregistrement...' : 'Valider'}
            </Button>
          </GlassDialogFooter>
        </form>

        {configuring && (
          <VariantConfigurator
            item={configuring.item}
            groups={configuring.groups}
            selections={configuring.selections}
            quantities={configuring.quantities}
            onToggle={toggleChoice}
            onQty={setChoiceQty}
            onCancel={() => setConfiguring(null)}
            onConfirm={confirmConfigured}
          />
        )}
      </GlassDialog>
    </>
  );
}

function VariantConfigurator({
  item,
  groups,
  selections,
  quantities,
  onToggle,
  onQty,
  onCancel,
  onConfirm,
}: {
  item: CatalogPickerItem;
  groups: OptionGroup[];
  selections: OptionSelections;
  quantities: OptionQuantities;
  onToggle: (group: OptionGroup, choiceId: string) => void;
  onQty: (choiceId: string, qty: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const unitPrice = computeItemUnitPrice(Number(item.price), groups, selections, quantities);
  const error = validateSelections(groups, selections);

  return (
    <GlassDialog open onClose={onCancel} icon={<SlidersHorizontal />} title={item.name} size="sm">
        <GlassDialogBody className="space-y-4">
          {groups.map((group) => {
            const max = effectiveMax(group);
            const hint =
              max > 1 && Number.isFinite(max)
                ? `(jusqu'à ${max})`
                : max > 1
                  ? '(plusieurs)'
                  : null;
            return (
              <div key={group.id}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {group.name}
                  {group.required && <span className="text-destructive"> *</span>}
                  {hint && <span className="ml-1 font-normal">{hint}</span>}
                </p>
                <div className="flex flex-col gap-1.5">
                  {group.choices.map((choice) => {
                    const active = (selections[group.id] ?? []).includes(choice.id);
                    const canQty =
                      active && group.kind === 'supplement' && (choice.maxQuantity ?? 1) > 1;
                    const qty = quantities[choice.id] ?? 1;
                    return (
                      <div key={choice.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggle(group, choice.id)}
                          className={`flex-1 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
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
                        {canQty && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onQty(choice.id, qty - 1)}
                              disabled={qty <= 1}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-40"
                              aria-label="Diminuer"
                            >
                              <Minus className="h-5 w-5" />
                            </button>
                            <span className="w-6 text-center text-xs">{qty}</span>
                            <button
                              type="button"
                              onClick={() =>
                                onQty(choice.id, Math.min(choice.maxQuantity ?? 99, qty + 1))
                              }
                              disabled={qty >= (choice.maxQuantity ?? 99)}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-40"
                              aria-label="Augmenter"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </GlassDialogBody>

        <GlassDialogFooter className="block">
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
        </GlassDialogFooter>
    </GlassDialog>
  );
}
