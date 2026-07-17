'use client';

import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { OptionGroup } from '@loyala/domain-crm';

function genId(): string {
  return globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
}

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
      choices: [{ id: genId(), label: 'Supplément', priceDelta: 500 }],
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

export function CatalogOptionsEditor({
  value,
  onChange,
  currencyLabel = 'FCFA',
}: {
  value: OptionGroup[];
  onChange: (groups: OptionGroup[]) => void;
  currencyLabel?: string;
}) {
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

  function updateChoice(
    groupId: string,
    choiceId: string,
    patch: Partial<OptionGroup['choices'][number]>
  ) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Variantes & options</label>
        <span className="text-xs text-muted-foreground">Le prix s'ajuste automatiquement</span>
      </div>

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
          {value.map((group) => (
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
                <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={group.required}
                    onChange={(e) => update(group.id, { required: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  Requis
                </label>
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                  aria-label="Supprimer le groupe"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 space-y-1.5 pl-6">
                {group.choices.map((choice) => (
                  <div key={choice.id} className="flex items-center gap-2">
                    <input
                      value={choice.label}
                      onChange={(e) => updateChoice(group.id, choice.id, { label: e.target.value })}
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
                        className={`${fieldClass} w-24 text-right`}
                      />
                      <span className="w-10 text-xs text-muted-foreground">{currencyLabel}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChoice(group.id, choice.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Retirer le choix"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
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
          ))}
        </div>
      )}
    </div>
  );
}
