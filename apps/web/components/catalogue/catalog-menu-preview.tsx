'use client';

import { useMemo } from 'react';
import type { CatalogCategory, CatalogItem } from '@loyala/domain-crm';
import { getItemOptions } from '@loyala/domain-crm';

function formatPrice(price: number, currency = 'XOF'): string {
  const label = currency === 'XOF' ? 'FCFA' : currency;
  return `${Number(price).toLocaleString('fr-FR')} ${label}`;
}

/**
 * Live mobile / QR menu preview — mirrors what a guest would see.
 * Pure client render of current props (instant).
 */
export function CatalogMenuPreview({
  categories,
  items,
  localeLabel = 'Menu',
}: {
  categories: CatalogCategory[];
  items: CatalogItem[];
  localeLabel?: string;
}) {
  const sections = useMemo(() => {
    const activeCats = categories.filter((c) => c.is_active);
    const uncategorized = items.filter((i) => i.is_active && !i.category_id);
    const blocks = activeCats
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: items.filter((i) => i.is_active && i.category_id === c.id),
      }))
      .filter((b) => b.items.length > 0);
    if (uncategorized.length > 0) {
      blocks.push({ id: '_none', name: 'Autres', items: uncategorized });
    }
    return blocks;
  }, [categories, items]);

  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="overflow-hidden rounded-[1.75rem] border-[8px] border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-center bg-zinc-900 py-2">
          <div className="h-1.5 w-16 rounded-full bg-zinc-700" />
        </div>
        <div className="max-h-[520px] overflow-y-auto bg-gradient-to-b from-zinc-900 to-zinc-950 px-3 pb-6 pt-3 text-zinc-100">
          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500">QR Menu</p>
          <h3 className="mt-1 text-center font-serif text-xl tracking-tight">{localeLabel}</h3>
          <p className="mt-1 text-center text-[11px] text-zinc-500">
            {items.filter((i) => i.is_active).length} article(s) · aperçu temps réel
          </p>

          {sections.length === 0 ? (
            <p className="mt-8 text-center text-xs text-zinc-500">Aucun article actif</p>
          ) : (
            <div className="mt-4 space-y-5">
              {sections.map((section) => (
                <section key={section.id}>
                  <h4 className="mb-2 border-b border-zinc-800 pb-1 text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                    {section.name}
                  </h4>
                  <ul className="space-y-3">
                    {section.items.map((item) => {
                      const opts = getItemOptions(item);
                      return (
                        <li key={item.id} className="flex gap-2">
                          {item.photo_url ? (
                            <img
                              src={item.photo_url}
                              alt=""
                              loading="lazy"
                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-[10px] text-zinc-500">
                              —
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-medium">{item.name}</p>
                              <p className="shrink-0 text-xs text-amber-100/80">
                                {formatPrice(item.price, item.currency)}
                              </p>
                            </div>
                            {item.description && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-400">
                                {item.description}
                              </p>
                            )}
                            {opts.length > 0 && (
                              <p className="mt-1 text-[10px] text-zinc-500">
                                {opts.map((g) => g.name).join(' · ')}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
