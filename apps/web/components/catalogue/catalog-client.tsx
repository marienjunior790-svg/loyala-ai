'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  Package,
  Wrench,
  Tags,
  X,
  ImageIcon,
  Images,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { CatalogCategory, CatalogItem, CatalogItemType, OptionGroup } from '@loyala/domain-crm';
import { getItemOptions } from '@loyala/domain-crm';
import {
  createItemAction,
  updateItemAction,
  deleteItemAction,
  toggleItemActiveAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from '@/app/(dashboard)/catalogue/_actions/catalog';
import {
  searchFreeImagesAction,
  saveProductImageAction,
} from '@/app/(dashboard)/catalogue/_actions/images';
import { CatalogAiPanel } from '@/components/catalogue/catalog-ai-create';
import { ProductImagePicker } from '@/components/catalogue/product-image-picker';
import { CatalogOptionsEditor } from '@/components/catalogue/catalog-options-editor';

type Tab = 'products' | 'services' | 'categories';

const TYPE_LABELS: Record<CatalogItemType, string> = {
  product: 'Produit',
  service: 'Service',
  rental: 'Location',
};

export function formatPrice(price: number, currency = 'XOF'): string {
  const label = currency === 'XOF' ? 'FCFA' : currency;
  return `${Number(price).toLocaleString('fr-FR')} ${label}`;
}

interface CatalogClientProps {
  categories: CatalogCategory[];
  items: CatalogItem[];
  canWrite: boolean;
}

export function CatalogClient({ categories, items, canWrite }: CatalogClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('products');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pending, startTransition] = useTransition();
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [pickerItem, setPickerItem] = useState<CatalogItem | null>(null);
  const [batch, setBatch] = useState<{ total: number; done: number } | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTab = tab === 'services' ? item.type === 'service' : item.type !== 'service';
      if (!matchesTab) return false;
      if (categoryFilter && item.category_id !== categoryFilter) return false;
      if (term) {
        const hay = `${item.name} ${item.sku ?? ''} ${item.description ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [items, tab, categoryFilter, search]);

  function run(fn: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) setMessage({ kind: 'error', text: res.error });
      else if (res.success) {
        setMessage({ kind: 'success', text: res.success });
        router.refresh();
      }
    });
  }

  function openNewItem() {
    setEditingItem(null);
    setItemDialogOpen(true);
  }

  function openEditItem(item: CatalogItem) {
    setEditingItem(item);
    setItemDialogOpen(true);
  }

  const missingPhotoCount = useMemo(
    () => items.filter((i) => !i.photo_url).length,
    [items]
  );

  async function illustrateMissing() {
    const targets = items.filter((i) => !i.photo_url);
    if (targets.length === 0) return;
    if (
      !confirm(
        `Rechercher automatiquement une image libre de droits pour ${targets.length} produit(s) sans photo ?`
      )
    ) {
      return;
    }
    setMessage(null);
    setBatch({ total: targets.length, done: 0 });
    let filled = 0;
    for (const item of targets) {
      try {
        const query = item.catalog_categories?.name
          ? `${item.name} ${item.catalog_categories.name}`
          : item.name;
        const search = await searchFreeImagesAction({ query });
        const first = search.results?.[0];
        if (first) {
          const saved = await saveProductImageAction({ itemId: item.id, externalUrl: first.url });
          if (!saved.error) filled += 1;
        }
      } catch {
        // best-effort — continue with the next product
      }
      setBatch((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }
    setBatch(null);
    setMessage({
      kind: 'success',
      text: `${filled} produit(s) illustré(s) sur ${targets.length}.`,
    });
    router.refresh();
  }

  const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'services', label: 'Services', icon: Wrench },
    { id: 'categories', label: 'Catégories', icon: Tags },
  ];

  const isEmpty = items.length === 0 && categories.length === 0;

  return (
    <div className="space-y-5">
      <CatalogAiPanel canWrite={canWrite} isEmpty={isEmpty} onManual={openNewItem} />

      {message && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.kind === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {isEmpty ? null : (
      <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'categories' ? (
        <CategoriesPanel
          categories={categories}
          canWrite={canWrite}
          pending={pending}
          onNew={() => {
            setEditingCategory(null);
            setCategoryDialogOpen(true);
          }}
          onEdit={(c) => {
            setEditingCategory(c);
            setCategoryDialogOpen(true);
          }}
          onDelete={(id) => {
            if (confirm('Supprimer cette catégorie ? Les articles associés ne seront pas supprimés.')) {
              run(() => deleteCategoryAction(id));
            }
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un article, un SKU..."
                className="pl-9"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {canWrite && missingPhotoCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={illustrateMissing}
                disabled={batch !== null || pending}
                title="Rechercher automatiquement des images libres de droits"
              >
                {batch !== null ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Illustration {batch.done}/{batch.total}
                  </>
                ) : (
                  <>
                    <Images className="h-4 w-4" />
                    Illustrer ({missingPhotoCount})
                  </>
                )}
              </Button>
            )}
            {canWrite && (
              <Button type="button" onClick={openNewItem}>
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            )}
          </div>

          {batch !== null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((batch.done / Math.max(batch.total, 1)) * 100)}%` }}
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Aucun {tab === 'services' ? 'service' : 'produit'} pour le moment.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col rounded-xl border border-border bg-background p-4 transition hover:border-primary/40 ${
                    item.is_active ? '' : 'opacity-60'
                  }`}
                >
                  <div className="relative mb-3 aspect-video overflow-hidden rounded-lg border border-border bg-secondary/30">
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-[11px]">Sans image</span>
                      </div>
                    )}
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setPickerItem(item)}
                        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-primary"
                      >
                        {item.photo_url ? (
                          <>
                            <Pencil className="h-3 w-3" /> Changer
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" /> Ajouter
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.catalog_categories?.name ?? 'Sans catégorie'}
                      </p>
                    </div>
                    <Badge variant={item.is_active ? 'default' : 'secondary'}>
                      {TYPE_LABELS[item.type]}
                    </Badge>
                  </div>

                  {item.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                  )}

                  {getItemOptions(item).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {getItemOptions(item).slice(0, 3).map((g) => (
                        <span
                          key={g.id}
                          className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-semibold">{formatPrice(item.price, item.currency)}</span>
                    {item.type === 'service' && item.duration_minutes ? (
                      <span className="text-xs text-muted-foreground">{item.duration_minutes} min</span>
                    ) : item.stock != null ? (
                      <span className="text-xs text-muted-foreground">Stock : {item.stock}</span>
                    ) : null}
                  </div>

                  {canWrite && (
                    <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
                      <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => toggleItemActiveAction(item.id, !item.is_active))}
                        title={item.is_active ? 'Désactiver' : 'Activer'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          if (confirm('Supprimer cet article ?')) run(() => deleteItemAction(item.id));
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </>
      )}

      {pickerItem && (
        <ProductImagePicker
          productName={pickerItem.name}
          category={pickerItem.catalog_categories?.name ?? undefined}
          type={pickerItem.type}
          itemId={pickerItem.id}
          onClose={() => setPickerItem(null)}
          onDone={() => {
            setPickerItem(null);
            setMessage({ kind: 'success', text: 'Image mise à jour.' });
            router.refresh();
          }}
        />
      )}

      {itemDialogOpen && (
        <ItemDialog
          item={editingItem}
          categories={categories}
          defaultType={tab === 'services' ? 'service' : 'product'}
          pending={pending}
          onClose={() => setItemDialogOpen(false)}
          onSubmit={(formData) => {
            const action = editingItem
              ? () => updateItemAction(editingItem.id, {}, formData)
              : () => createItemAction({}, formData);
            startTransition(async () => {
              const res = await action();
              if (res.error) setMessage({ kind: 'error', text: res.error });
              else {
                setMessage({ kind: 'success', text: res.success ?? 'Enregistré' });
                setItemDialogOpen(false);
                router.refresh();
              }
            });
          }}
        />
      )}

      {categoryDialogOpen && (
        <CategoryDialog
          category={editingCategory}
          pending={pending}
          onClose={() => setCategoryDialogOpen(false)}
          onSubmit={(formData) => {
            const action = editingCategory
              ? () => updateCategoryAction(editingCategory.id, {}, formData)
              : () => createCategoryAction({}, formData);
            startTransition(async () => {
              const res = await action();
              if (res.error) setMessage({ kind: 'error', text: res.error });
              else {
                setMessage({ kind: 'success', text: res.success ?? 'Enregistré' });
                setCategoryDialogOpen(false);
                router.refresh();
              }
            });
          }}
        />
      )}
    </div>
  );
}

function CategoriesPanel({
  categories,
  canWrite,
  pending,
  onNew,
  onEdit,
  onDelete,
}: {
  categories: CatalogCategory[];
  canWrite: boolean;
  pending: boolean;
  onNew: () => void;
  onEdit: (c: CatalogCategory) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button type="button" onClick={onNew}>
            <Plus className="h-4 w-4" />
            Ajouter une catégorie
          </Button>
        </div>
      )}
      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Aucune catégorie. Créez-en pour organiser votre catalogue.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{c.name}</p>
                {c.description && (
                  <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                )}
              </div>
              {canWrite && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => onDelete(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputClass =
  'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-[min(100%,32rem)] max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ItemDialog({
  item,
  categories,
  defaultType,
  pending,
  onClose,
  onSubmit,
}: {
  item: CatalogItem | null;
  categories: CatalogCategory[];
  defaultType: CatalogItemType;
  pending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const [type, setType] = useState<CatalogItemType>(item?.type ?? defaultType);
  const [name, setName] = useState(item?.name ?? '');
  const [photoUrl, setPhotoUrl] = useState(item?.photo_url ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [options, setOptions] = useState<OptionGroup[]>(item ? getItemOptions(item) : []);
  const cleanOptions = options.filter((g) => g.name.trim() && g.choices.some((c) => c.label.trim()));

  return (
    <DialogShell title={item ? "Modifier l'article" : 'Nouvel article'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
        className="space-y-4 px-6 py-5"
      >
        <div>
          <label className="text-sm text-muted-foreground">Nom *</label>
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground">Type</label>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as CatalogItemType)}
              className={inputClass}
            >
              <option value="product">Produit</option>
              <option value="service">Service</option>
              <option value="rental">Location</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Catégorie</label>
            <select name="categoryId" defaultValue={item?.category_id ?? ''} className={inputClass}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground">Prix *</label>
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={item?.price ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Devise</label>
            <input name="currency" defaultValue={item?.currency ?? 'XOF'} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground">TVA (%)</label>
            <input
              name="taxRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={item?.tax_rate ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">SKU</label>
            <input name="sku" defaultValue={item?.sku ?? ''} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {type === 'service' ? (
            <div>
              <label className="text-sm text-muted-foreground">Durée (min)</label>
              <input
                name="durationMinutes"
                type="number"
                min={0}
                defaultValue={item?.duration_minutes ?? ''}
                className={inputClass}
              />
            </div>
          ) : (
            <div>
              <label className="text-sm text-muted-foreground">Stock</label>
              <input
                name="stock"
                type="number"
                defaultValue={item?.stock ?? ''}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground">Photo</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                name="photoUrl"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="URL ou générer/importer"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={name.trim().length < 2}
                onClick={() => setPickerOpen(true)}
                title={name.trim().length < 2 ? "Saisissez d'abord le nom" : 'Choisir une image'}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </div>
            {photoUrl && (
              <img
                src={photoUrl}
                alt=""
                loading="lazy"
                className="mt-2 h-20 w-full rounded-lg border border-border object-cover"
              />
            )}
          </div>
        </div>

        {pickerOpen && (
          <ProductImagePicker
            productName={name.trim()}
            type={type}
            itemId={item?.id}
            onClose={() => setPickerOpen(false)}
            onDone={(url) => {
              setPhotoUrl(url);
              setPickerOpen(false);
            }}
          />
        )}

        <div>
          <label className="text-sm text-muted-foreground">Description</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={item?.description ?? ''}
            className={inputClass}
          />
        </div>

        <div className="rounded-lg border border-border p-3">
          <CatalogOptionsEditor value={options} onChange={setOptions} />
        </div>
        <input
          type="hidden"
          name="optionsJson"
          value={JSON.stringify(
            cleanOptions.map((g) => ({
              ...g,
              choices: g.choices.filter((c) => c.label.trim()),
            }))
          )}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={item ? item.is_active : true}
            className="h-4 w-4 rounded border-input"
          />
          Actif (disponible à la vente)
        </label>
        {/* Ensure a value is always submitted for isActive */}
        <input type="hidden" name="isActive" value="false" />

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? 'Enregistrement...' : 'Valider'}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

function CategoryDialog({
  category,
  pending,
  onClose,
  onSubmit,
}: {
  category: CatalogCategory | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <DialogShell title={category ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
        className="space-y-4 px-6 py-5"
      >
        <div>
          <label className="text-sm text-muted-foreground">Nom *</label>
          <input name="name" required defaultValue={category?.name ?? ''} className={inputClass} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Description</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={category?.description ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Ordre d'affichage</label>
          <input
            name="sortOrder"
            type="number"
            defaultValue={category?.sort_order ?? 0}
            className={inputClass}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? 'Enregistrement...' : 'Valider'}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
