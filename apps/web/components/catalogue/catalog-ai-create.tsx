'use client';

import { useRef, useState, useTransition } from 'react';
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
  ClipboardPaste,
  X,
  Loader2,
  Trash2,
  Plus,
  Send,
  Upload,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  generateCatalogAction,
  importCatalogFromTextAction,
  importCatalogFromUrlAction,
  importCatalogFromImageAction,
  applyGeneratedCatalogAction,
  suggestVariantsAction,
  type CatalogAiState,
} from '@/app/(dashboard)/catalogue/_actions/catalog';
import { CatalogOptionsEditor } from '@/components/catalogue/catalog-options-editor';
import { CATALOG_TEMPLATES } from '@/lib/catalogue/templates';
import type { OptionGroup } from '@loyala/domain-crm';
import {
  fileToDataUrl,
  spreadsheetToText,
  pdfToText,
  decodeQrFromImage,
} from '@/lib/catalogue/extract-client';
import type { GeneratedCatalogInput } from '@loyala/validation';

const CURRENCY_LABEL = (currency: string) => (currency === 'XOF' ? 'FCFA' : currency);

const BRIEF_EXAMPLES = [
  'Menu complet pour un restaurant de burgers et grillades',
  'Carte de cocktails et boissons pour un bar lounge',
  'Prestations et soins pour un salon de coiffure',
  'Viennoiseries, pains et pâtisseries pour une boulangerie',
];

type DialogMode =
  | 'generate'
  | 'import-text'
  | 'import-url'
  | 'import-file'
  | 'import-image'
  | 'import-qr'
  | 'template';

interface CatalogAiPanelProps {
  canWrite: boolean;
  establishmentType?: string;
  isEmpty: boolean;
  onManual: () => void;
}

export function CatalogAiPanel({ canWrite, establishmentType, isEmpty, onManual }: CatalogAiPanelProps) {
  const [dialog, setDialog] = useState<{ mode: DialogMode; brief?: string } | null>(null);
  const [assistant, setAssistant] = useState('');
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  if (!canWrite) return null;

  return (
    <>
      {isEmpty ? (
        <CreationLauncher
          onPick={(action, label) => {
            if (action === 'manual') onManual();
            else if (action === 'soon') setComingSoon(label);
            else setDialog({ mode: action });
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/5 to-transparent p-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Assistant IA</span>
          </div>
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (assistant.trim()) setDialog({ mode: 'generate', brief: assistant.trim() });
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
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setDialog({ mode: 'import-file' })}>
              <Upload className="h-4 w-4" />
              Importer
            </Button>
            <Button type="button" onClick={() => setDialog({ mode: 'generate' })}>
              <Wand2 className="h-4 w-4" />
              Créer avec l'IA
            </Button>
          </div>
        </div>
      )}

      {comingSoon && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          « {comingSoon} » arrive bientôt. En attendant, importez votre menu par PDF, photo, Excel,
          CSV, URL ou QR Code — ou générez-le avec l'IA en quelques secondes.
        </div>
      )}

      {dialog && (
        <SmartCatalogDialog
          mode={dialog.mode}
          initialBrief={dialog.brief ?? ''}
          establishmentType={establishmentType}
          onClose={() => {
            setDialog(null);
            setAssistant('');
          }}
        />
      )}
    </>
  );
}

type MethodAction = DialogMode | 'manual' | 'soon';

const METHODS: {
  id: string;
  label: string;
  desc: string;
  icon: typeof Wand2;
  action: MethodAction;
  primary?: boolean;
}[] = [
  { id: 'ai', label: 'Créer avec l\u2019IA', desc: 'Décrivez votre activité, l\u2019IA génère tout', icon: Wand2, action: 'generate', primary: true },
  { id: 'template', label: 'Utiliser un modèle', desc: 'Modèles prêts à l\u2019emploi par secteur', icon: LayoutTemplate, action: 'template' },
  { id: 'pdf', label: 'Importer un PDF', desc: 'Menu PDF — texte extrait puis analysé', icon: FileText, action: 'import-file' },
  { id: 'image', label: 'Importer une image', desc: 'Photo / scan — OCR + Vision IA', icon: ImageIcon, action: 'import-image' },
  { id: 'file', label: 'Importer Excel / CSV', desc: 'Depuis un tableur (.xlsx, .csv)', icon: Table2, action: 'import-file' },
  { id: 'web', label: 'Importer depuis une URL', desc: 'Lien vers votre menu en ligne', icon: Globe, action: 'import-url' },
  { id: 'qr', label: 'Scanner un QR Code', desc: 'Image d\u2019un QR de menu existant', icon: QrCode, action: 'import-qr' },
  { id: 'paste', label: 'Coller le menu', desc: 'Copier-coller depuis un doc', icon: ClipboardPaste, action: 'import-text' },
  { id: 'copy', label: 'Copier un catalogue', desc: 'Depuis un autre établissement', icon: Copy, action: 'soon' },
  { id: 'manual', label: 'Commencer manuellement', desc: 'Ajouter les articles un par un', icon: Pencil, action: 'manual' },
];

function CreationLauncher({ onPick }: { onPick: (action: MethodAction, label: string) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-primary/5 to-transparent p-6 sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-semibold">Créez votre catalogue en moins de 5 minutes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ne partez jamais d\u2019une page vide. Générez avec l\u2019IA, importez un menu existant, ou
          partez d\u2019un modèle — puis validez.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METHODS.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.action, m.label)}
              className={`group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition ${
                m.primary
                  ? 'border-primary bg-primary/10 hover:bg-primary/15 shadow-glow'
                  : 'border-border bg-background hover:border-primary/40'
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  m.primary ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                }`}
              >
                <Icon className="h-[1.1rem] w-[1.1rem]" />
              </div>
              <div>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
              {m.action === 'soon' && (
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

const DIALOG_TITLE: Record<DialogMode, string> = {
  generate: 'Créer avec l\u2019IA',
  'import-text': 'Coller un menu',
  'import-url': 'Importer depuis une URL',
  'import-file': 'Importer un fichier (PDF, Excel, CSV)',
  'import-image': 'Importer une photo du menu',
  'import-qr': 'Scanner un QR Code',
  template: 'Choisir un modèle',
};

function SmartCatalogDialog({
  mode,
  initialBrief,
  establishmentType,
  onClose,
}: {
  mode: DialogMode;
  initialBrief: string;
  establishmentType?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLInputElement>(null);
  const [brief, setBrief] = useState(initialBrief);
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<GeneratedCatalogInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [applying, startApply] = useTransition();
  const [, startSuggest] = useTransition();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [suggestingKey, setSuggestingKey] = useState<string | null>(null);
  const [bulkSuggest, setBulkSuggest] = useState<{ done: number; total: number } | null>(null);

  function toggleItemVariants(key: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleResult(res: CatalogAiState) {
    if (res.error) setError(res.error);
    else if (res.preview) setPreview(res.preview);
  }

  function runGenerate() {
    if (!brief.trim()) return setError('Décrivez ce que vous souhaitez générer.');
    setError(null);
    startBusy(async () => handleResult(await generateCatalogAction({ brief: brief.trim(), establishmentType })));
  }

  function runImportText(text: string) {
    if (text.trim().length < 10) return setError('Collez le contenu de votre menu.');
    setError(null);
    startBusy(async () => handleResult(await importCatalogFromTextAction({ rawText: text, establishmentType })));
  }

  function runImportUrl() {
    if (!url.trim()) return setError('Saisissez le lien de votre menu.');
    setError(null);
    startBusy(async () => handleResult(await importCatalogFromUrlAction({ url: url.trim() })));
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    try {
      const text = isPdf ? await pdfToText(file) : await spreadsheetToText(file);
      if (text.trim().length < 10) {
        setError(
          isPdf
            ? 'Ce PDF ne contient pas de texte sélectionnable (menu scanné ?). Utilisez plutôt « Importer une image ».'
            : 'Fichier vide ou illisible.'
        );
        return;
      }
      startBusy(async () =>
        handleResult(await importCatalogFromTextAction({ rawText: text, establishmentType }))
      );
    } catch {
      setError('Impossible de lire ce fichier. Formats acceptés : .pdf, .xlsx, .xls, .csv');
    }
  }

  async function handleImages(files: FileList) {
    setError(null);
    const list = Array.from(files).slice(0, 4);
    setFileName(list.map((f) => f.name).join(', '));
    try {
      const images = await Promise.all(list.map((f) => fileToDataUrl(f)));
      startBusy(async () =>
        handleResult(await importCatalogFromImageAction({ images, establishmentType }))
      );
    } catch {
      setError('Impossible de lire cette image. Formats acceptés : JPG, PNG, WebP, HEIC.');
    }
  }

  async function handleQr(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      const decoded = await decodeQrFromImage(file);
      if (!decoded) {
        setError('Aucun QR Code détecté sur cette image. Cadrez bien le code et réessayez.');
        return;
      }
      const isUrl = /^https?:\/\//i.test(decoded.trim());
      startBusy(async () =>
        handleResult(
          isUrl
            ? await importCatalogFromUrlAction({ url: decoded.trim() })
            : await importCatalogFromTextAction({ rawText: decoded, establishmentType })
        )
      );
    } catch {
      setError('Lecture du QR Code impossible.');
    }
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

  function updateItem(
    ci: number,
    ii: number,
    patch: { name?: string; price?: number; options?: OptionGroup[] }
  ) {
    setPreview((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((c, i) =>
        i === ci ? { ...c, items: c.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : c
      );
      return { ...prev, categories };
    });
  }

  /** Merge suggested groups into an item, skipping groups it already has (by name). */
  function mergeItemOptions(ci: number, ii: number, groups: OptionGroup[]) {
    setPreview((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((c, i) => {
        if (i !== ci) return c;
        return {
          ...c,
          items: c.items.map((it, j) => {
            if (j !== ii) return it;
            const existing = (it.options as OptionGroup[] | undefined) ?? [];
            const existingNames = new Set(existing.map((g) => g.name.toLowerCase()));
            const toAdd = groups.filter((g) => !existingNames.has(g.name.toLowerCase()));
            return { ...it, options: [...existing, ...toAdd] };
          }),
        };
      });
      return { ...prev, categories };
    });
    setExpandedItems((prev) => new Set(prev).add(`${ci}-${ii}`));
  }

  /** AI suggestion for a single product. */
  function suggestForItem(ci: number, ii: number) {
    if (!preview) return;
    const cat = preview.categories[ci];
    const item = cat?.items[ii];
    if (!item) return;
    const key = `${ci}-${ii}`;
    setSuggestingKey(key);
    setError(null);
    startSuggest(async () => {
      const res = await suggestVariantsAction({
        items: [{ name: item.name, category: cat.name, type: item.type }],
      });
      setSuggestingKey(null);
      if (res.error) return setError(res.error);
      const groups = res.suggestions?.[item.name.trim()] ?? [];
      if (groups.length === 0) return setError('Aucune variante pertinente pour ce produit.');
      mergeItemOptions(ci, ii, groups);
    });
  }

  /** AI suggestion for every product still missing variants. */
  function suggestForAll() {
    if (!preview) return;
    setError(null);
    const targets: { ci: number; ii: number; name: string; category: string; type: string }[] = [];
    preview.categories.forEach((cat, ci) => {
      cat.items.forEach((item, ii) => {
        const has = ((item.options as OptionGroup[] | undefined) ?? []).length > 0;
        if (!has && item.name.trim()) {
          targets.push({ ci, ii, name: item.name.trim(), category: cat.name, type: item.type });
        }
      });
    });
    if (targets.length === 0) {
      setError('Tous les produits ont déjà des variantes.');
      return;
    }
    setBulkSuggest({ done: 0, total: targets.length });
    startSuggest(async () => {
      // One batched call (server caps the batch); results keyed by product name.
      const res = await suggestVariantsAction({
        items: targets.map((t) => ({ name: t.name, category: t.category, type: t.type })),
      });
      if (res.error) {
        setBulkSuggest(null);
        return setError(res.error);
      }
      const suggestions = res.suggestions ?? {};
      let done = 0;
      for (const t of targets) {
        const groups = suggestions[t.name] ?? [];
        if (groups.length > 0) mergeItemOptions(t.ci, t.ii, groups);
        done += 1;
        setBulkSuggest({ done, total: targets.length });
      }
      setBulkSuggest(null);
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
        className="flex max-h-[92vh] w-[min(100%,46rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">{DIALOG_TITLE[mode]}</h3>
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
          {/* ── Input step (hidden once a preview exists, except template picker) ── */}
          {!preview && mode === 'generate' && (
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
            </div>
          )}

          {!preview && mode === 'import-text' && (
            <div>
              <label className="text-sm text-muted-foreground">
                Collez le texte de votre menu (depuis un PDF, un document, un site…)
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder={'Entrées\nSalade César - 3000\nNems x4 - 2500\n\nPlats\nPoulet braisé - 4500 ...'}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {!preview && mode === 'import-url' && (
            <div>
              <label className="text-sm text-muted-foreground">Lien vers votre menu en ligne</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://qr.mydigimenu.com/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="mt-1"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                DigiMenu QR, page menu HTML ou JSON. Collez l’URL complète (pas tronquée). Si le site
                bloque l’accès, importez une image ou un PDF.
              </p>
            </div>
          )}

          {!preview && mode === 'import-file' && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf,.xlsx,.xls,.csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-10 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <Download className="h-6 w-6" />
                {fileName ? `Fichier : ${fileName}` : 'Cliquez pour choisir un fichier .pdf, .xlsx, .xls ou .csv'}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                PDF : le texte est extrait automatiquement. Tableur : une colonne par nom, catégorie,
                prix et description donne les meilleurs résultats.
              </p>
            </div>
          )}

          {!preview && mode === 'import-image' && (
            <div>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void handleImages(e.target.files);
                }}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void handleImages(e.target.files);
                }}
              />
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-10 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <ImageIcon className="h-6 w-6" />
                {fileName ? `Photo(s) : ${fileName}` : 'Choisir une ou plusieurs photos du menu'}
              </button>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  OCR + Vision IA. Jusqu'à 4 photos nettes et bien cadrées.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                  <ImageIcon className="h-4 w-4" />
                  Prendre une photo
                </Button>
              </div>
            </div>
          )}

          {!preview && mode === 'import-qr' && (
            <div>
              <input
                ref={qrRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleQr(f);
                }}
              />
              <button
                type="button"
                onClick={() => qrRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-10 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <QrCode className="h-6 w-6" />
                {fileName ? `Image : ${fileName}` : 'Choisir une image contenant le QR Code du menu'}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Le QR Code est décodé, puis la page du menu est analysée automatiquement.
              </p>
            </div>
          )}

          {!preview && mode === 'template' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {CATALOG_TEMPLATES.map((t) => {
                const count = t.data.categories.reduce((n, c) => n + c.items.length, 0);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreview(t.data)}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/40"
                  >
                    <span className="text-2xl">{t.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      <p className="mt-1 text-xs text-primary">
                        {t.data.categories.length} catégories · {count} articles
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {busy && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {mode === 'generate' ? 'L\u2019IA génère votre catalogue…' : 'Analyse du contenu en cours…'}
            </div>
          )}

          {/* ── Editable preview (shared by every mode) ── */}
          {preview && !busy && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {preview.categories.length} catégorie(s) · {totalItems} article(s)
                </p>
                <button
                  type="button"
                  onClick={suggestForAll}
                  disabled={!!bulkSuggest}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
                >
                  {bulkSuggest ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Variantes… {bulkSuggest.done}/{bulkSuggest.total}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Suggérer des variantes pour tout le catalogue
                    </>
                  )}
                </button>
              </div>
              {bulkSuggest && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.round((bulkSuggest.done / Math.max(1, bulkSuggest.total)) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Modifiez, ajoutez des variantes, puis validez. Rien n'est enregistré avant « Ajouter au catalogue ».
              </p>
              {preview.categories.map((cat, ci) => (
                <div key={`${cat.name}-${ci}`} className="rounded-xl border border-border">
                  <div className="border-b border-border bg-secondary/40 px-4 py-2 text-sm font-medium">
                    {cat.name}
                  </div>
                  <div className="divide-y divide-border">
                    {cat.items.map((item, ii) => {
                      const key = `${ci}-${ii}`;
                      const groups = (item.options as OptionGroup[] | undefined) ?? [];
                      const open = expandedItems.has(key);
                      const isSuggesting = suggestingKey === key;
                      return (
                        <div key={`${item.name}-${ii}`} className="px-3 py-2">
                          <div className="flex items-center gap-2">
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
                              onClick={() => suggestForItem(ci, ii)}
                              disabled={isSuggesting}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-60"
                              title="Suggérer des variantes (IA)"
                            >
                              {isSuggesting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleItemVariants(key)}
                              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs transition ${
                                groups.length > 0
                                  ? 'border-primary/40 text-primary'
                                  : 'border-border text-muted-foreground hover:text-foreground'
                              }`}
                              title="Variantes & options"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              {groups.length > 0 && <span>{groups.length}</span>}
                              {open ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(ci, ii)}
                              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Retirer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {open && (
                            <div className="mt-2 rounded-lg border border-border bg-background/60 p-3">
                              <CatalogOptionsEditor
                                value={groups}
                                onChange={(g) => updateItem(ci, ii, { options: g })}
                                currencyLabel={CURRENCY_LABEL(preview.currency)}
                                itemName={item.name}
                                itemCategory={cat.name}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
          {preview ? (
            <>
              <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={applying}>
                Retour
              </Button>
              <Button type="button" className="flex-1" onClick={apply} disabled={applying || totalItems === 0}>
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
          ) : mode === 'template' ? (
            <p className="text-xs text-muted-foreground">Sélectionnez un modèle pour continuer.</p>
          ) : mode === 'import-file' || mode === 'import-image' || mode === 'import-qr' ? (
            <p className="text-xs text-muted-foreground">
              {busy ? 'Analyse en cours…' : 'Choisissez un fichier pour lancer l\u2019analyse.'}
            </p>
          ) : (
            <Button
              type="button"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                if (mode === 'generate') runGenerate();
                else if (mode === 'import-text') runImportText(rawText);
                else if (mode === 'import-url') runImportUrl();
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === 'generate' ? 'Génération…' : 'Analyse…'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {mode === 'generate' ? 'Générer le catalogue' : 'Analyser'}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
