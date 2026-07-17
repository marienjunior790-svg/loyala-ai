'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Sparkles, Settings2 } from 'lucide-react';
import type { OptionGroup } from '@loyala/domain-crm';
import { suggestVariants } from '@loyala/domain-crm';

type Availability = NonNullable<OptionGroup['choices'][number]['availability']>;
type Choice = OptionGroup['choices'][number];

function genId(): string {
  return globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

type Preset = { label: string; make: () => OptionGroup };

const PRESETS: Preset[] = [
  {
    label: 'Taille',
    make: () => ({
      id: genId(),
      name: 'Taille',
      kind: 'size',
      selection: 'single',
      required: true,
      choices: [
        { id: genId(), label: 'Petite', priceDelta: 0, isDefault: true },
        { id: genId(), label: 'Moyenne', priceDelta: 500 },
        { id: genId(), label: 'Grande', priceDelta: 1000 },
      ],
    }),
  },
  {
    label: 'Portion',
    make: () => ({
      id: genId(),
      name: 'Portion',
      kind: 'portion',
      selection: 'single',
      required: true,
      choices: [
        { id: genId(), label: 'Simple', priceDelta: 0, isDefault: true },
        { id: genId(), label: 'Double', priceDelta: 1500 },
      ],
    }),
  },
  {
    label: 'Cuisson',
    make: () => ({
      id: genId(),
      name: 'Cuisson',
      kind: 'cooking',
      selection: 'single',
      required: true,
      choices: [
        { id: genId(), label: 'Saignant', priceDelta: 0 },
        { id: genId(), label: 'À point', priceDelta: 0, isDefault: true },
        { id: genId(), label: 'Bien cuit', priceDelta: 0 },
      ],
    }),
  },
  {
    label: 'Saveur',
    make: () => ({
      id: genId(),
      name: 'Saveur',
      kind: 'flavor',
      selection: 'single',
      required: false,
      choices: [{ id: genId(), label: 'Nature', priceDelta: 0, isDefault: true }],
    }),
  },
  {
    label: 'Température',
    make: () => ({
      id: genId(),
      name: 'Température',
      kind: 'temperature',
      selection: 'single',
      required: false,
      choices: [
        { id: genId(), label: 'Chaud', priceDelta: 0, isDefault: true },
        { id: genId(), label: 'Froid', priceDelta: 0 },
      ],
    }),
  },
  {
    label: 'Niveau de piquant',
    make: () => ({
      id: genId(),
      name: 'Niveau de piquant',
      kind: 'spice',
      selection: 'single',
      required: false,
      choices: [
        { id: genId(), label: 'Doux', priceDelta: 0, isDefault: true },
        { id: genId(), label: 'Moyen', priceDelta: 0 },
        { id: genId(), label: 'Fort', priceDelta: 0 },
      ],
    }),
  },
  {
    label: 'Suppléments',
    make: () => ({
      id: genId(),
      name: 'Suppléments',
      kind: 'supplement',
      selection: 'multiple',
      required: false,
      choices: [{ id: genId(), label: 'Supplément', priceDelta: 500, maxQuantity: 5 }],
    }),
  },
  {
    label: 'Groupe (min/max)',
    make: () => ({
      id: genId(),
      name: 'Choisissez votre boisson',
      kind: 'custom',
      selection: 'single',
      required: true,
      minChoices: 1,
      maxChoices: 1,
      choices: [
        { id: genId(), label: 'Coca', priceDelta: 0 },
        { id: genId(), label: 'Fanta', priceDelta: 0 },
        { id: genId(), label: 'Sprite', priceDelta: 0 },
      ],
    }),
  },
  {
    label: 'Ingrédients retirables',
    make: () => ({
      id: genId(),
      name: 'Retirer',
      kind: 'removable',
      selection: 'multiple',
      required: false,
      choices: [{ id: genId(), label: 'Ingrédient', priceDelta: 0 }],
    }),
  },
  {
    label: 'Personnalisé',
    make: () => ({
      id: genId(),
      name: 'Option',
      kind: 'custom',
      selection: 'single',
      required: false,
      choices: [{ id: genId(), label: 'Choix', priceDelta: 0 }],
    }),
  },
];

const fieldClass =
  'rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring';

function AvailabilityEditor({
  value,
  onChange,
}: {
  value: Availability | undefined;
  onChange: (a: Availability | undefined) => void;
}) {
  const status = value?.status ?? 'available';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-20 text-xs text-muted-foreground">Disponibilité</span>
        <select
          value={status}
          onChange={(e) => {
            const next = e.target.value as Availability['status'];
            if (next === 'available') onChange(undefined);
            else if (next === 'unavailable') onChange({ status: 'unavailable' });
            else onChange({ status: 'scheduled', days: value?.days, timeStart: value?.timeStart, timeEnd: value?.timeEnd });
          }}
          className={fieldClass}
        >
          <option value="available">Disponible</option>
          <option value="unavailable">Indisponible (rupture)</option>
          <option value="scheduled">Programmé (jours/heures)</option>
        </select>
      </div>
      {status === 'scheduled' && (
        <div className="space-y-2 pl-20">
          <div className="flex flex-wrap gap-1">
            {DAY_LABELS.map((label, day) => {
              const active = value?.days?.includes(day) ?? false;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    const current = new Set(value?.days ?? []);
                    if (current.has(day)) current.delete(day);
                    else current.add(day);
                    onChange({ ...(value ?? { status: 'scheduled' }), status: 'scheduled', days: [...current].sort() });
                  }}
                  className={`rounded-md border px-2 py-0.5 text-xs transition ${
                    active
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>De</span>
            <input
              type="time"
              value={value?.timeStart ?? ''}
              onChange={(e) => onChange({ ...(value ?? { status: 'scheduled' }), status: 'scheduled', timeStart: e.target.value || undefined })}
              className={fieldClass}
            />
            <span>à</span>
            <input
              type="time"
              value={value?.timeEnd ?? ''}
              onChange={(e) => onChange({ ...(value ?? { status: 'scheduled' }), status: 'scheduled', timeEnd: e.target.value || undefined })}
              className={fieldClass}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CatalogOptionsEditor({
  value,
  onChange,
  currencyLabel = 'FCFA',
  itemName,
  itemCategory,
}: {
  value: OptionGroup[];
  onChange: (groups: OptionGroup[]) => void;
  currencyLabel?: string;
  itemName?: string;
  itemCategory?: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(choiceId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(choiceId)) next.delete(choiceId);
      else next.add(choiceId);
      return next;
    });
  }

  function update(groupId: string, patch: Partial<OptionGroup>) {
    onChange(value.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  }

  function removeGroup(groupId: string) {
    onChange(value.filter((g) => g.id !== groupId));
  }

  function addChoice(groupId: string) {
    onChange(
      value.map((g) =>
        g.id === groupId
          ? { ...g, choices: [...g.choices, { id: genId(), label: '', priceDelta: 0 }] }
          : g
      )
    );
  }

  function updateChoice(groupId: string, choiceId: string, patch: Partial<Choice>) {
    onChange(
      value.map((g) =>
        g.id === groupId
          ? {
              ...g,
              choices: g.choices.map((c) => (c.id === choiceId ? { ...c, ...patch } : c)),
            }
          : g
      )
    );
  }

  function removeChoice(groupId: string, choiceId: string) {
    onChange(
      value.map((g) =>
        g.id === groupId ? { ...g, choices: g.choices.filter((c) => c.id !== choiceId) } : g
      )
    );
  }

  function applySuggestions() {
    if (!itemName) return;
    const suggested = suggestVariants(itemName, itemCategory ?? undefined);
    if (suggested.length === 0) return;
    const existingNames = new Set(value.map((g) => g.name.toLowerCase()));
    const toAdd = suggested.filter((g) => !existingNames.has(g.name.toLowerCase()));
    if (toAdd.length > 0) onChange([...value, ...toAdd]);
  }

  const canSuggest = Boolean(itemName && suggestVariants(itemName, itemCategory ?? undefined).length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Variantes & options</label>
        <span className="text-xs text-muted-foreground">Le prix s'ajuste automatiquement</span>
      </div>

      {canSuggest && (
        <button
          type="button"
          onClick={applySuggestions}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Suggérer des variantes pour « {itemName} »
        </button>
      )}

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange([...value, p.make()])}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            {p.label}
          </button>
        ))}
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Aucune variante. Ajoutez une taille, des suppléments, une cuisson…
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((group) => {
            const isSupplement = group.kind === 'supplement';
            return (
              <div key={group.id} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={group.name}
                    onChange={(e) => update(group.id, { name: e.target.value })}
                    placeholder="Nom du groupe"
                    className={`${fieldClass} min-w-0 flex-1 font-medium`}
                  />
                  <select
                    value={group.selection}
                    onChange={(e) =>
                      update(group.id, { selection: e.target.value as 'single' | 'multiple' })
                    }
                    className={fieldClass}
                  >
                    <option value="single">Choix unique</option>
                    <option value="multiple">Choix multiples</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                    aria-label="Supprimer le groupe"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 pl-6 text-xs text-muted-foreground">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={group.required}
                      onChange={(e) => update(group.id, { required: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                    Requis
                  </label>
                  <label className="inline-flex items-center gap-1">
                    Min
                    <input
                      type="number"
                      min={0}
                      value={group.minChoices ?? ''}
                      placeholder="—"
                      onChange={(e) =>
                        update(group.id, {
                          minChoices: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className={`${fieldClass} w-14`}
                    />
                  </label>
                  <label className="inline-flex items-center gap-1">
                    Max
                    <input
                      type="number"
                      min={1}
                      value={group.maxChoices ?? ''}
                      placeholder="—"
                      onChange={(e) =>
                        update(group.id, {
                          maxChoices: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className={`${fieldClass} w-14`}
                    />
                  </label>
                </div>

                <div className="mt-2 space-y-1.5 pl-6">
                  {group.choices.map((choice) => {
                    const isOpen = expanded.has(choice.id);
                    return (
                      <div key={choice.id} className="rounded-md border border-transparent hover:border-border/60">
                        <div className="flex items-center gap-2">
                          <input
                            value={choice.label}
                            onChange={(e) =>
                              updateChoice(group.id, choice.id, { label: e.target.value })
                            }
                            placeholder="Libellé"
                            className={`${fieldClass} min-w-0 flex-1`}
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">+</span>
                            <input
                              type="number"
                              step="0.01"
                              value={choice.priceDelta}
                              onChange={(e) =>
                                updateChoice(group.id, choice.id, {
                                  priceDelta: Number(e.target.value) || 0,
                                })
                              }
                              className={`${fieldClass} w-20 text-right`}
                            />
                            <span className="w-9 text-xs text-muted-foreground">{currencyLabel}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(choice.id)}
                            className={`rounded-md p-1 transition hover:bg-muted ${
                              isOpen ? 'text-primary' : 'text-muted-foreground'
                            }`}
                            aria-label="Options avancées"
                            title="SKU, disponibilité, temps de préparation, image…"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeChoice(group.id, choice.id)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Retirer le choix"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {isOpen && (
                          <div className="mt-1.5 space-y-2 rounded-md bg-muted/40 p-2.5">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                SKU
                                <input
                                  value={choice.sku ?? ''}
                                  onChange={(e) =>
                                    updateChoice(group.id, choice.id, { sku: e.target.value })
                                  }
                                  placeholder="REF-001"
                                  className={`${fieldClass} w-28`}
                                />
                              </label>
                              <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                Prépa (min)
                                <input
                                  type="number"
                                  min={0}
                                  value={choice.prepTimeMinutes ?? ''}
                                  onChange={(e) =>
                                    updateChoice(group.id, choice.id, {
                                      prepTimeMinutes:
                                        e.target.value === '' ? undefined : Number(e.target.value),
                                    })
                                  }
                                  className={`${fieldClass} w-16`}
                                />
                              </label>
                              {isSupplement && (
                                <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  Qté max
                                  <input
                                    type="number"
                                    min={1}
                                    value={choice.maxQuantity ?? ''}
                                    onChange={(e) =>
                                      updateChoice(group.id, choice.id, {
                                        maxQuantity:
                                          e.target.value === '' ? undefined : Number(e.target.value),
                                      })
                                    }
                                    className={`${fieldClass} w-16`}
                                  />
                                </label>
                              )}
                            </div>
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="w-20">Image (URL)</span>
                              <input
                                value={choice.imageUrl ?? ''}
                                onChange={(e) =>
                                  updateChoice(group.id, choice.id, { imageUrl: e.target.value })
                                }
                                placeholder="https://…"
                                className={`${fieldClass} min-w-0 flex-1`}
                              />
                            </label>
                            <AvailabilityEditor
                              value={choice.availability}
                              onChange={(a) =>
                                updateChoice(group.id, choice.id, { availability: a })
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addChoice(group.id)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter un choix
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
