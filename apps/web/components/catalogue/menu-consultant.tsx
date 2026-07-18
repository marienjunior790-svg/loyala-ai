'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Loader2,
  X,
  RefreshCw,
  Save,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  consultMenuAction,
  previewMenuContextAction,
  applyMenuProposalAction,
  type MenuConsultState,
} from '@/app/(dashboard)/catalogue/_actions/menu-consult';
import type { MenuGoal, MenuKind, DietaryConstraint } from '@loyala/domain-crm';

const GOALS: { id: MenuGoal; label: string }[] = [
  { id: 'general', label: 'Optimisation générale' },
  { id: 'panier_moyen', label: 'Augmenter le panier moyen' },
  { id: 'nouveautes', label: 'Vendre les nouveautés' },
  { id: 'marges', label: 'Augmenter les marges' },
  { id: 'stocks', label: 'Écouler des stocks' },
  { id: 'acquisition', label: 'Attirer de nouveaux clients' },
  { id: 'fidelisation', label: 'Fidéliser' },
  { id: 'categorie', label: 'Promouvoir une catégorie' },
];

const KINDS: { id: MenuKind; label: string }[] = [
  { id: 'jour', label: 'Menu du jour' },
  { id: 'semaine', label: 'Menu semaine' },
  { id: 'weekend', label: 'Week-end' },
  { id: 'midi', label: 'Midi' },
  { id: 'soir', label: 'Soirée' },
  { id: 'degustation', label: 'Dégustation' },
  { id: 'enfant', label: 'Enfant' },
  { id: 'famille', label: 'Famille' },
  { id: 'etudiant', label: 'Étudiant' },
  { id: 'entreprise', label: 'Entreprise' },
  { id: 'saisonnier', label: 'Saisonnier' },
  { id: 'evenementiel', label: 'Événementiel' },
  { id: 'promotionnel', label: 'Promotionnel' },
];

const DIETARY: { id: DietaryConstraint; label: string }[] = [
  { id: 'halal', label: 'Halal' },
  { id: 'vegetarien', label: 'Végétarien' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'sans_gluten', label: 'Sans gluten' },
  { id: 'sans_lactose', label: 'Sans lactose' },
  { id: 'faible_calorie', label: 'Faible calorie' },
  { id: 'proteine', label: 'Riche en protéines' },
  { id: 'enfant', label: 'Enfant' },
];

const ROLE_LABEL: Record<string, string> = {
  entree: 'Entrée',
  plat: 'Plat',
  dessert: 'Dessert',
  boisson: 'Boisson',
  supplement: 'Supplément',
  autre: 'Autre',
};

function money(n: number, currency = 'XOF') {
  const label = currency === 'XOF' ? 'FCFA' : currency;
  return `${Math.round(n).toLocaleString('fr-FR')} ${label}`;
}

export function MenuConsultantPanel({
  open,
  onClose,
  canWrite,
}: {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick');
  const [goal, setGoal] = useState<MenuGoal>('general');
  const [menuKind, setMenuKind] = useState<MenuKind>('jour');
  const [dietary, setDietary] = useState<DietaryConstraint[]>([]);
  const [brief, setBrief] = useState('');
  const [showCriteria, setShowCriteria] = useState(false);
  const [showMarketing, setShowMarketing] = useState(true);
  const [state, setState] = useState<MenuConsultState>({});
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!open) return null;

  const request = {
    goal,
    menuKind,
    dietary,
    brief: brief.trim() || undefined,
    mode,
  };

  function runConsult() {
    if (!canWrite) return;
    setMsg(null);
    setState({});
    start(async () => {
      const res = await consultMenuAction(request);
      setState(res);
      setSelectedIdx(0);
      if (res.error) setMsg(res.error);
    });
  }

  function runPreviewContext() {
    setMsg(null);
    start(async () => {
      const res = await previewMenuContextAction(request);
      setState((prev) => ({ ...prev, context: res.context, error: res.error }));
      setShowCriteria(true);
      if (res.error) setMsg(res.error);
    });
  }

  function toggleDiet(d: DietaryConstraint) {
    setDietary((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function publishSelected() {
    const proposal = state.result?.proposals[selectedIdx];
    if (!proposal) return;
    setMsg(null);
    start(async () => {
      const res = await applyMenuProposalAction({
        proposalName: proposal.name,
        proposalDescription: proposal.description,
        suggestedPrice: proposal.suggestedPrice,
        courses: proposal.courses,
        currency: state.result?.currency,
        additions: state.result?.catalogAdditions,
      });
      setMsg(res.error ?? res.success ?? null);
      if (res.success) router.refresh();
    });
  }

  const proposal = state.result?.proposals[selectedIdx];
  const currency = state.result?.currency ?? 'XOF';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card text-foreground shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold sm:text-lg">Consultant menus IA</h3>
              <p className="text-xs text-muted-foreground">
                Décisions basées sur catalogue, CRM, ventes et saison
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('quick')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                mode === 'quick' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              Génération rapide
            </button>
            <button
              type="button"
              onClick={() => setMode('advanced')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                mode === 'advanced' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              Génération avancée
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Objectif
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as MenuGoal)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {GOALS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Type de menu
              <select
                value={menuKind}
                onChange={(e) => setMenuKind(e.target.value as MenuKind)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mode === 'advanced' && (
            <>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Contraintes alimentaires</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDiet(d.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        dietary.includes(d.id)
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Brief libre (optionnel)</label>
                <Input
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Ex : mettre en avant les pizzas + boissons pour le week-end"
                  className="mt-1"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={runPreviewContext}>
                  Voir les critères utilisés
                </Button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCriteria((v) => !v)}
                >
                  {showCriteria ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showCriteria ? 'Masquer le contexte' : 'Afficher le contexte'}
                </button>
              </div>
            </>
          )}

          {showCriteria && state.context && (
            <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{state.context.organization.name}</span>
                {' · '}
                {state.context.organization.establishmentType}
                {' · '}
                saison {state.context.season.season}
                {state.context.season.upcomingEvents.length > 0 &&
                  ` · ${state.context.season.upcomingEvents.join(', ')}`}
              </p>
              <p>
                Catalogue score {state.context.catalog.qualityScore}/100 ·{' '}
                {state.context.catalog.items.length} articles · CRM{' '}
                {state.context.crm.totalClients} clients (VIP {state.context.crm.segments.vip},
                inactifs {state.context.crm.segments.inactive})
              </p>
              {state.context.sales.topProducts.length > 0 && (
                <p>
                  Top produits :{' '}
                  {state.context.sales.topProducts
                    .slice(0, 5)
                    .map((p) => `${p.name}(${p.clientCount})`)
                    .join(', ')}
                </p>
              )}
            </div>
          )}

          {pending && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Analyse des données et génération des menus…
            </div>
          )}

          {state.result && !pending && (
            <div className="space-y-4">
              {state.result.summary && (
                <p className="text-sm text-muted-foreground">{state.result.summary}</p>
              )}
              {state.result.contextInsights?.length > 0 && (
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {state.result.contextInsights.map((insight) => (
                    <li key={insight}>{insight}</li>
                  ))}
                </ul>
              )}

              {state.result.proposals.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {state.result.proposals.map((p, i) => (
                    <button
                      key={`${p.name}-${i}`}
                      type="button"
                      onClick={() => setSelectedIdx(i)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        i === selectedIdx
                          ? 'border-primary bg-primary/10'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {p.name} · {p.confidence}%
                    </button>
                  ))}
                </div>
              )}

              {proposal && (
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="text-lg font-semibold">{proposal.name}</h4>
                      <p className="text-sm text-muted-foreground">{proposal.description}</p>
                    </div>
                    <div className="rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
                      Confiance {Math.round(proposal.confidence)} %
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {proposal.courses.map((c, i) => (
                      <div
                        key={`${c.catalogItemName}-${i}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          <span className="text-muted-foreground">
                            {ROLE_LABEL[c.role] ?? c.role} ·{' '}
                          </span>
                          {c.label || c.catalogItemName}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {money(c.price, currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-sm">
                    <span>
                      Prix conseillé{' '}
                      <strong className="text-primary">{money(proposal.suggestedPrice, currency)}</strong>
                      {proposal.discountPercent ? ` (−${proposal.discountPercent}%)` : ''}
                    </span>
                    {proposal.estimatedMargin != null && (
                      <span className="text-muted-foreground">
                        Marge est. {money(proposal.estimatedMargin, currency)}
                        {proposal.estimatedMarginPct != null
                          ? ` (${Math.round(proposal.estimatedMarginPct)}%)`
                          : ''}
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg bg-secondary/40 p-3 text-sm">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Analyse commerciale
                    </p>
                    <p>{proposal.commercialAnalysis}</p>
                    {proposal.confidenceReasons?.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                        {proposal.confidenceReasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {state.result.marketing && (
                <div className="rounded-xl border border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
                    onClick={() => setShowMarketing((v) => !v)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-primary" />
                      Pack marketing automatique
                    </span>
                    {showMarketing ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {showMarketing && (
                    <div className="space-y-3 border-t border-border px-4 py-3 text-sm">
                      {state.result.marketing.whatsapp && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">WhatsApp</p>
                          <p className="mt-0.5 whitespace-pre-wrap">{state.result.marketing.whatsapp}</p>
                        </div>
                      )}
                      {state.result.marketing.sms && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">SMS</p>
                          <p className="mt-0.5">{state.result.marketing.sms}</p>
                        </div>
                      )}
                      {(state.result.marketing.emailSubject || state.result.marketing.emailBody) && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Email</p>
                          <p className="mt-0.5 font-medium">{state.result.marketing.emailSubject}</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {state.result.marketing.emailBody}
                          </p>
                        </div>
                      )}
                      {['facebook', 'instagram', 'tiktok', 'linkedin'].map((ch) => {
                        const text = (state.result?.marketing as Record<string, string> | undefined)?.[
                          ch
                        ];
                        if (!text) return null;
                        return (
                          <div key={ch}>
                            <p className="text-xs font-medium capitalize text-muted-foreground">{ch}</p>
                            <p className="mt-0.5 whitespace-pre-wrap">{text}</p>
                          </div>
                        );
                      })}
                      {state.result.marketing.hashtags?.length > 0 && (
                        <p className="text-xs text-primary">
                          {state.result.marketing.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                        </p>
                      )}
                      {state.result.marketing.posterPrompt && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Prompt affiche (générateur d&apos;images)
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {state.result.marketing.posterPrompt}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {msg && (
            <p
              className={`text-sm ${
                msg.toLowerCase().includes('erreur') || msg.toLowerCase().includes('indispon')
                  ? 'text-destructive'
                  : 'text-primary'
              }`}
            >
              {msg}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button type="button" className="flex-1" disabled={pending || !canWrite} onClick={runConsult}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {state.result ? 'Régénérer' : 'Générer les menus'}
              </>
            )}
          </Button>
          {state.result && proposal && (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={runConsult}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button type="button" disabled={pending || !canWrite} onClick={publishSelected}>
                <Save className="h-4 w-4" />
                Publier au catalogue
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
