'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Wand2,
  FileText,
  Image as ImageIcon,
  Table2,
  Globe,
  QrCode,
  Copy,
  LayoutTemplate,
  Pencil,
  X,
  Loader2,
  Trash2,
  Plus,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  generateCatalogAction,
  applyGeneratedCatalogAction,
  type CatalogAiState,
} from '@/app/(dashboard)/catalogue/_actions/catalog';
import type { GeneratedCatalogInput } from '@loyala/validation';

const CURRENCY_LABEL = (currency: string) => (currency === 'XOF' ? 'FCFA' : currency);

const BRIEF_EXAMPLES = [
  'Menu complet pour un restaurant de burgers et grillades',
  'Carte de cocktails et boissons pour un bar lounge',
  'Prestations et soins pour un salon de coiffure',
  'Viennoiseries, pains et pâtisseries pour une boulangerie',
];

interface CatalogAiPanelProps {
  canWrite: boolean;
  establishmentType?: string;
  isEmpty: boolean;
  onManual: () => void;
}

export function CatalogAiPanel({ canWrite, establishmentType, isEmpty, onManual }: CatalogAiPanelProps) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState('');
  const [assistant, setAssistant] = useState('');
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  if (!canWrite) return null;

  function openAi(brief = '') {
    setPrefill(brief);
    setOpen(true);
  }

  return (
    <>
      {isEmpty ? (
        <CreationLauncher
          onAi={() => openAi('')}
          onManual={onManual}
          onComingSoon={setComingSoon}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/5 to-transparent p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Assistant IA</span>
          </div>
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (assistant.trim()) openAi(assistant.trim());
            }}
          >
            <Input
              value={assistant}
              onChange={(e) => setAssistant(e.target.value)}
              placeholder="Ex : Ajoute 15 pizzas · Ajoute une catégorie Desserts · Génère une carte de vins"
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={!assistant.trim()}>
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Envoyer</span>
            </Button>
          </form>
          <Button type="button" onClick={() => openAi('')}>
            <Wand2 className="h-4 w-4" />
            Créer avec l'IA
          </Button>
        </div>
      )}

      {comingSoon && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          « {comingSoon} » arrive bientôt. En attendant, utilisez « Créer avec l'IA » pour générer
          votre catalogue en quelques secondes.
        </div>
      )}

      {open && (
        <AiCatalogDialog
          initialBrief={prefill}
          establishmentType={establishmentType}
          onClose={() => {
            setOpen(false);
            setAssistant('');
          }}
        />
      )}
    </>
  );
}

const METHODS: {
  id: string;
  label: string;
  desc: string;
  icon: typeof Wand2;
  status: 'ai' | 'manual' | 'soon';
}[] = [
  { id: 'ai', label: 'Créer avec l\u2019IA', desc: 'Décrivez votre activité, l\u2019IA génère tout', icon: Wand2, status: 'ai' },
  { id: 'pdf', label: 'Importer un PDF', desc: 'Votre menu existant en PDF', icon: FileText, status: 'soon' },
  { id: 'image', label: 'Importer une image', desc: 'Photo ou scan de la carte', icon: ImageIcon, status: 'soon' },
  { id: 'excel', label: 'Importer Excel / CSV', desc: 'Depuis un tableur', icon: Table2, status: 'soon' },
  { id: 'web', label: 'Importer depuis un site', desc: 'URL de votre menu en ligne', icon: Globe, status: 'soon' },
  { id: 'qr', label: 'Scanner un QR Code', desc: 'Menu digital existant', icon: QrCode, status: 'soon' },
  { id: 'template', label: 'Utiliser un modèle', desc: 'Modèles prêts à l\u2019emploi', icon: LayoutTemplate, status: 'soon' },
  { id: 'copy', label: 'Copier un catalogue', desc: 'Depuis un autre établissement', icon: Copy, status: 'soon' },
  { id: 'manual', label: 'Commencer manuellement', desc: 'Ajouter les articles un par un', icon: Pencil, status: 'manual' },
];

function CreationLauncher({
  onAi,
  onManual,
  onComingSoon,
}: {
  onAi: () => void;
  onManual: () => void;
  onComingSoon: (label: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-primary/5 to-transparent p-6 sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-semibold">Créez votre catalogue en moins de 5 minutes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ne partez jamais d\u2019une page vide. Laissez l\u2019IA générer vos catégories, plats,
          descriptions et prix — puis validez.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const isPrimary = m.status === 'ai';
          return (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                m.status === 'ai' ? onAi() : m.status === 'manual' ? onManual() : onComingSoon(m.label)
              }
              className={`group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition ${
                isPrimary
                  ? 'border-primary bg-primary/10 hover:bg-primary/15 shadow-glow'
                  : 'border-border bg-background hover:border-primary/40'
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isPrimary ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
              {m.status === 'soon' && (
                <span className="absolute right-3 top-3 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Bientôt
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AiCatalogDialog({
  initialBrief,
  establishmentType,
  onClose,
}: {
  initialBrief: string;
  establishmentType?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState(initialBrief);
  const [preview, setPreview] = useState<GeneratedCatalogInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [applying, startApply] = useTransition();

  function generate(currentBrief: string) {
    const value = currentBrief.trim();
    if (!value) {
      setError('Décrivez ce que vous souhaitez générer.');
      return;
    }
    setError(null);
    startGenerate(async () => {
      const res: CatalogAiState = await generateCatalogAction({
        brief: value,
        establishmentType,
      });
      if (res.error) setError(res.error);
      else if (res.preview) setPreview(res.preview);
    });
  }

  function apply() {
    if (!preview) return;
    setError(null);
    startApply(async () => {
      const res = await applyGeneratedCatalogAction(preview);
      if (res.error) setError(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  const totalItems = preview?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;

  function updateItem(ci: number, ii: number, patch: { name?: string; price?: number }) {
    setPreview((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((c, i) => {
        if (i !== ci) return c;
        return {
          ...c,
          items: c.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)),
        };
      });
      return { ...prev, categories };
    });
  }

  function removeItem(ci: number, ii: number) {
    setPreview((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((c, i) =>
        i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c
      );
      return { ...prev, categories: categories.filter((c) => c.items.length > 0) };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-[min(100%,44rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Créer avec l'IA</h3>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="text-sm text-muted-foreground">
              Décrivez votre établissement ou ce que vous voulez ajouter
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="Ex : Restaurant de burgers avec entrées, plats, desserts et boissons"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {!preview && (
              <div className="mt-2 flex flex-wrap gap-2">
                {BRIEF_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setBrief(ex)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {generating && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              L'IA génère votre catalogue…
            </div>
          )}

          {preview && !generating && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {preview.categories.length} catégorie(s) · {totalItems} article(s)
                </p>
                <span className="text-xs text-muted-foreground">
                  Modifiez ou supprimez avant d'ajouter
                </span>
              </div>
              {preview.categories.map((cat, ci) => (
                <div key={`${cat.name}-${ci}`} className="rounded-xl border border-border">
                  <div className="border-b border-border bg-secondary/40 px-4 py-2 text-sm font-medium">
                    {cat.name}
                  </div>
                  <div className="divide-y divide-border">
                    {cat.items.map((item, ii) => (
                      <div key={`${item.name}-${ii}`} className="flex items-center gap-2 px-3 py-2">
                        <input
                          value={item.name}
                          onChange={(e) => updateItem(ci, ii, { name: e.target.value })}
                          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-border focus:border-primary"
                        />
                        <input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => updateItem(ci, ii, { price: Number(e.target.value) })}
                          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="w-12 text-xs text-muted-foreground">
                          {CURRENCY_LABEL(preview.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(ci, ii)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Retirer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
          {preview ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => generate(brief)}
                disabled={generating || applying}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Régénérer
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={apply}
                disabled={applying || totalItems === 0}
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ajout en cours…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Ajouter {totalItems} article(s) au catalogue
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="flex-1"
              onClick={() => generate(brief)}
              disabled={generating || !brief.trim()}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Générer le catalogue
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
