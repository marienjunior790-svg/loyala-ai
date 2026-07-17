'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Sparkles,
  Search,
  Upload,
  Camera,
  Loader2,
  X,
  ImageIcon,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  generateProductImagesAction,
  searchFreeImagesAction,
  saveProductImageAction,
  type FreeImageSuggestion,
} from '@/app/(dashboard)/catalogue/_actions/images';
import { compressImageToWebp } from '@/lib/catalogue/image-client';

type PickerTab = 'ai' | 'search' | 'upload' | 'camera';

interface ProductImagePickerProps {
  productName: string;
  category?: string;
  type?: string;
  /** When provided, the chosen image is linked to this catalog item server-side. */
  itemId?: string;
  onDone: (url: string) => void;
  onClose: () => void;
}

const TABS: { id: PickerTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'ai', label: 'Générer (IA)', icon: Sparkles },
  { id: 'search', label: 'Rechercher', icon: Search },
  { id: 'upload', label: 'Importer', icon: Upload },
  { id: 'camera', label: 'Photo', icon: Camera },
];

export function ProductImagePicker({
  productName,
  category,
  type,
  itemId,
  onDone,
  onClose,
}: ProductImagePickerProps) {
  const [tab, setTab] = useState<PickerTab>('ai');
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [saving, startSaving] = useTransition();

  const [variants, setVariants] = useState<string[]>([]);
  const [query, setQuery] = useState(
    category ? `${productName} ${category}` : productName
  );
  const [results, setResults] = useState<FreeImageSuggestion[]>([]);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function generate() {
    setError(null);
    setVariants([]);
    startBusy(async () => {
      const res = await generateProductImagesAction({ name: productName, category, type });
      if (res.error) setError(res.error);
      else setVariants(res.images ?? []);
    });
  }

  function search() {
    if (query.trim().length < 2) return setError('Saisissez un terme de recherche.');
    setError(null);
    setResults([]);
    startBusy(async () => {
      const res = await searchFreeImagesAction({ query: query.trim() });
      if (res.error) setError(res.error);
      else setResults(res.results ?? []);
    });
  }

  async function handleLocalFile(file: File) {
    setError(null);
    try {
      const compressed = await compressImageToWebp(file);
      setLocalPreview(compressed);
    } catch {
      setError('Impossible de lire cette image.');
    }
  }

  function save(payload: { dataUrl?: string; externalUrl?: string }) {
    setError(null);
    startSaving(async () => {
      const res = await saveProductImageAction({ itemId, ...payload });
      if (res.error) setError(res.error);
      else if (res.url) onDone(res.url);
    });
  }

  const loadingLabel = saving ? 'Enregistrement…' : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-[min(100%,44rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <ImageIcon className="h-5 w-5 shrink-0 text-primary" />
            <h3 className="truncate text-lg font-semibold">Image · {productName}</h3>
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

        <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setError(null);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {saving && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingLabel}
            </div>
          )}

          {/* ── Generate (AI) ── */}
          {tab === 'ai' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Génère des visuels photoréalistes correspondant au produit.
                </p>
                <Button type="button" onClick={generate} disabled={busy || saving}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Génération…
                    </>
                  ) : (
                    <>
                      {variants.length > 0 ? (
                        <RefreshCw className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {variants.length > 0 ? 'Régénérer' : 'Générer'}
                    </>
                  )}
                </Button>
              </div>
              {busy && variants.length === 0 && <SkeletonGrid />}
              {variants.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {variants.map((src, i) => (
                    <ChoiceTile
                      key={i}
                      src={src}
                      disabled={saving}
                      onSelect={() => save({ dataUrl: src })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Free search ── */}
          {tab === 'search' && (
            <div className="space-y-4">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  search();
                }}
              >
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex : pizza margherita"
                  className="flex-1"
                />
                <Button type="submit" variant="outline" disabled={busy || saving}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Chercher
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Images libres de droits (licence commerciale) via Openverse.
              </p>
              {busy && results.length === 0 && <SkeletonGrid />}
              {results.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {results.map((r, i) => (
                    <ChoiceTile
                      key={i}
                      src={r.thumbnail}
                      caption={r.source}
                      disabled={saving}
                      onSelect={() => save({ externalUrl: r.url })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Upload ── */}
          {tab === 'upload' && (
            <UploadPane
              inputRef={uploadRef}
              accept="image/*"
              preview={localPreview}
              disabled={saving}
              hint="Formats : JPG, PNG, WebP. Compressée automatiquement."
              label="Choisir une image depuis l'appareil"
              onFile={handleLocalFile}
              onValidate={() => localPreview && save({ dataUrl: localPreview })}
            />
          )}

          {/* ── Camera ── */}
          {tab === 'camera' && (
            <UploadPane
              inputRef={cameraRef}
              accept="image/*"
              capture="environment"
              preview={localPreview}
              disabled={saving}
              hint="Ouvre l'appareil photo sur mobile."
              label="Prendre une photo"
              onFile={handleLocalFile}
              onValidate={() => localPreview && save({ dataUrl: localPreview })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceTile({
  src,
  caption,
  disabled,
  onSelect,
}: {
  src: string;
  caption?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary/30 transition hover:border-primary disabled:opacity-60"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover transition group-hover:scale-105"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-primary/0 opacity-0 transition group-hover:bg-primary/20 group-hover:opacity-100">
        <span className="rounded-full bg-primary p-2 text-primary-foreground">
          <Check className="h-5 w-5" />
        </span>
      </span>
      {caption && (
        <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-2 py-0.5 text-[10px] text-white">
          {caption}
        </span>
      )}
    </button>
  );
}

function UploadPane({
  inputRef,
  accept,
  capture,
  preview,
  disabled,
  hint,
  label,
  onFile,
  onValidate,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  capture?: 'environment' | 'user';
  preview: string | null;
  disabled?: boolean;
  hint: string;
  label: string;
  onFile: (file: File) => void;
  onValidate: () => void;
}) {
  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {preview ? (
        <div className="space-y-3">
          <div className="mx-auto aspect-video max-h-64 overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Aperçu" className="h-full w-full object-contain" />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              Changer
            </Button>
            <Button type="button" className="flex-1" onClick={onValidate} disabled={disabled}>
              <Check className="h-4 w-4" />
              Valider cette image
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          {capture ? <Camera className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
          {label}
        </button>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse rounded-xl bg-secondary/50" />
      ))}
    </div>
  );
}
