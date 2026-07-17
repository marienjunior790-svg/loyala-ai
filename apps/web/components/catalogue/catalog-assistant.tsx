'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Languages, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateCatalogAction, applyGeneratedCatalogAction } from '@/app/(dashboard)/catalogue/_actions/catalog';
import { translateCatalogAction } from '@/app/(dashboard)/catalogue/_actions/translate';
import { suggestVariantsAction } from '@/app/(dashboard)/catalogue/_actions/catalog';
import type { CatalogItem } from '@loyala/domain-crm';
import { getItemOptions } from '@loyala/domain-crm';

const QUICK = [
  { label: 'Ajouter desserts', prompt: 'Ajoute une catégorie Desserts avec 6 desserts populaires.' },
  { label: 'Réécrire descriptions', prompt: 'Propose des descriptions marketing courtes pour compléter le catalogue existant (ne duplique pas).' },
  { label: 'Variantes boissons', prompt: 'Ajoute des tailles et options de lait pour les boissons chaudes.' },
  { label: 'Traduire EN', action: 'translate:en' as const },
  { label: 'Sans photo', action: 'find:no-photo' as const },
];

export function CatalogAssistantPanel({
  canWrite,
  items,
  open,
  onClose,
  onHighlightNoPhoto,
}: {
  canWrite: boolean;
  items: CatalogItem[];
  open: boolean;
  onClose: () => void;
  onHighlightNoPhoto?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [log, setLog] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [pending, start] = useTransition();

  if (!open) return null;

  function push(role: 'user' | 'assistant', msg: string) {
    setLog((prev) => [...prev, { role, text: msg }]);
  }

  function runPrompt(prompt: string) {
    if (!canWrite || !prompt.trim()) return;
    push('user', prompt);
    setText('');
    start(async () => {
      const res = await generateCatalogAction({ brief: prompt });
      if (res.error) {
        push('assistant', res.error);
        return;
      }
      if (!res.preview) {
        push('assistant', 'Aucune suggestion générée.');
        return;
      }
      const n = res.preview.categories.reduce((a, c) => a + c.items.length, 0);
      if (
        confirm(
          `L’IA propose ${res.preview.categories.length} catégorie(s) et ${n} article(s). Les ajouter au catalogue ?`
        )
      ) {
        const applied = await applyGeneratedCatalogAction(res.preview);
        push('assistant', applied.error ?? applied.success ?? 'Fait.');
        if (applied.success) router.refresh();
      } else {
        push('assistant', 'Proposition annulée — rien n’a été enregistré.');
      }
    });
  }

  function runQuick(q: (typeof QUICK)[number]) {
    if ('action' in q && q.action === 'translate:en') {
      push('user', 'Traduire le catalogue en anglais');
      start(async () => {
        const res = await translateCatalogAction({ locale: 'en', replaceLive: false });
        push('assistant', res.error ?? res.success ?? 'Traduction terminée.');
        if (res.success) router.refresh();
      });
      return;
    }
    if ('action' in q && q.action === 'find:no-photo') {
      const n = items.filter((i) => !i.photo_url).length;
      push('user', 'Trouve les produits sans photo');
      push('assistant', n === 0 ? 'Tous les produits ont une photo.' : `${n} produit(s) sans photo.`);
      onHighlightNoPhoto?.();
      return;
    }
    if ('prompt' in q && q.prompt) runPrompt(q.prompt);
  }

  function suggestMissingVariants() {
    push('user', 'Ajoute des variantes aux produits qui en manquent');
    start(async () => {
      const targets = items
        .filter((i) => getItemOptions(i).length === 0)
        .slice(0, 20)
        .map((i) => ({
          name: i.name,
          category: i.catalog_categories?.name,
          type: i.type,
        }));
      if (targets.length === 0) {
        push('assistant', 'Tous les produits ont déjà des variantes.');
        return;
      }
      const res = await suggestVariantsAction({ items: targets });
      if (res.error) {
        push('assistant', res.error);
        return;
      }
      const count = Object.keys(res.suggestions ?? {}).length;
      push(
        'assistant',
        count === 0
          ? 'Aucune variante pertinente détectée.'
          : `${count} produit(s) ont des suggestions — ouvrez un article pour les appliquer via l’éditeur de variantes.`
      );
    });
  }

  return (
    <aside className="fixed bottom-4 right-4 z-40 flex h-[min(70vh,560px)] w-[min(100%-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-primary" />
          Assistant catalogue
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={pending || !canWrite}
            onClick={() => runQuick(q)}
            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            {q.label === 'Traduire EN' ? <Languages className="mr-0.5 inline h-3 w-3" /> : null}
            {q.label}
          </button>
        ))}
        <button
          type="button"
          disabled={pending || !canWrite}
          onClick={suggestMissingVariants}
          className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40"
        >
          <Sparkles className="mr-0.5 inline h-3 w-3" />
          Variantes manquantes
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm">
        {log.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ex. « Ajoute une catégorie Cocktails », « Traduis en anglais », « Trouve les produits sans photo ».
            Les actions IA demandent confirmation avant enregistrement.
          </p>
        )}
        {log.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-2.5 py-1.5 text-xs ${
              m.role === 'user' ? 'ml-6 bg-primary/15 text-foreground' : 'mr-4 bg-secondary text-muted-foreground'
            }`}
          >
            {m.text}
          </div>
        ))}
        {pending && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Traitement…
          </p>
        )}
      </div>

      <form
        className="flex gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          runPrompt(text);
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Demandez à l’IA…"
          disabled={!canWrite || pending}
          className="h-9 text-sm"
        />
        <Button type="submit" size="sm" disabled={!canWrite || pending || !text.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </aside>
  );
}
