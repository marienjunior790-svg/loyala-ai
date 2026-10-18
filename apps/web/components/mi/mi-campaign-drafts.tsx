'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { MiInsightCampaignProposal } from '@/lib/mi/format-insights';
import type { MiLocale } from '@/lib/mi/ui-copy';
import {
  applyMiCampaignDraftEdits,
  validateMiCampaignDraft,
  type MiCampaignDraft,
  CAMPAIGN_TYPES,
  type CampaignType,
} from '@loyala/domain-crm';

function priorityLabel(p: MiInsightCampaignProposal['priority'], fr: boolean): string {
  if (p === 'high') return fr ? 'Priorité haute' : 'High priority';
  if (p === 'medium') return fr ? 'Priorité moyenne' : 'Medium priority';
  return fr ? 'Priorité basse' : 'Low priority';
}

export function MiCampaignDraftsPanel({
  proposals,
  locale,
}: {
  proposals: MiInsightCampaignProposal[];
  locale: MiLocale;
}) {
  const fr = locale !== 'en';
  const [draft, setDraft] = React.useState<MiCampaignDraft | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [savedHint, setSavedHint] = React.useState<string | null>(null);

  const openDraft = (proposal: MiInsightCampaignProposal) => {
    const type = (CAMPAIGN_TYPES as readonly string[]).includes(proposal.campaignType)
      ? (proposal.campaignType as CampaignType)
      : 'manual';
    const built: MiCampaignDraft = {
      draftId: `local_${proposal.id}`,
      proposalId: proposal.id,
      name: proposal.suggestedName,
      type,
      objective: proposal.objective,
      targetSegmentKey: proposal.targetSegmentKey,
      targetingCriteria: proposal.targetingCriteria,
      audienceHeadcount: proposal.audienceHeadcount,
      message: proposal.suggestedMessage,
      callToAction: proposal.suggestedCta,
      messageVariants: [...proposal.messageVariants],
      status: 'draft',
      contentSource: 'template',
      isDraftOnly: true,
      persistenceNote:
        'Brouillon MI uniquement — non enregistré. La création persistée exige clients:write et le module Campagnes (hors P3).',
      period: { ...proposal.period },
      limits: [...proposal.limits],
    };
    setDraft(built);
    setErrors([]);
    setSavedHint(null);
  };

  const onField = (field: keyof Pick<MiCampaignDraft, 'name' | 'message' | 'callToAction' | 'objective' | 'type'>, value: string) => {
    if (!draft) return;
    const next = applyMiCampaignDraftEdits(draft, {
      [field]: field === 'type' ? (value as CampaignType) : value,
    });
    setDraft(next);
    setSavedHint(null);
  };

  const onValidate = () => {
    if (!draft) return;
    const result = validateMiCampaignDraft(draft);
    setErrors(result.errors);
    if (result.ok) {
      setSavedHint(
        fr
          ? 'Brouillon valide localement — non enregistré (P3). Utilisez Campagnes + clients:write pour persister.'
          : 'Draft valid locally — not saved (P3). Use Campaigns + clients:write to persist.'
      );
    }
  };

  if (proposals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="mi-campaign-empty">
        {fr
          ? 'Aucune proposition de campagne pour cette période (audiences vides ou données insuffisantes pour un produit phare).'
          : 'No campaign proposal for this period (empty audiences or insufficient product data).'}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="mi-campaign-proposals">
      <h3 className="text-sm font-semibold">
        {fr ? 'Propositions de campagne (brouillons)' : 'Campaign proposals (drafts)'}
      </h3>
      <p className="text-[11px] text-muted-foreground">
        {fr
          ? 'Déterministes, effectifs CRM réels. Aucun envoi ni enregistrement depuis MI.'
          : 'Deterministic, real CRM headcounts. No send or save from MI.'}
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {proposals.map((p) => (
          <Card key={p.id} data-testid="mi-campaign-proposal" data-objective={p.objectiveId}>
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    p.priority === 'high' ? 'destructive' : p.priority === 'medium' ? 'warning' : 'secondary'
                  }
                >
                  {priorityLabel(p.priority, fr)}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {p.campaignType}
                </Badge>
                <Badge variant="outline">
                  {p.targetSegmentKey} · n={p.audienceHeadcount}
                </Badge>
              </div>
              <CardTitle className="text-sm leading-snug">{p.suggestedName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground/80">{fr ? 'Objectif' : 'Objective'}: </span>
                {p.objective}
              </p>
              <p>
                <span className="font-medium text-foreground/80">{fr ? 'Ciblage' : 'Targeting'}: </span>
                {p.targetingCriteria}
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {p.analyticalJustification.slice(0, 4).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {p.limits[0] ? (
                <p>
                  <span className="font-medium text-foreground/80">{fr ? 'Limites' : 'Limits'}: </span>
                  {p.limits[0]}
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-1"
                data-testid="mi-campaign-open-draft"
                onClick={() => openDraft(p)}
              >
                {fr ? 'Préparer le brouillon' : 'Prepare draft'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {draft ? (
        <Card className="border-primary/30" data-testid="mi-campaign-draft-editor">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm">
                {fr ? 'Éditeur de brouillon' : 'Draft editor'}
              </CardTitle>
              <Badge variant="warning">{fr ? 'Brouillon non persisté' : 'Unsaved draft'}</Badge>
              <Badge variant="outline">{draft.contentSource}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">{draft.persistenceNote}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">{fr ? 'Nom' : 'Name'}</span>
              <Input
                value={draft.name}
                onChange={(e) => onField('name', e.target.value)}
                data-testid="mi-draft-name"
                maxLength={120}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">{fr ? 'Type CRM' : 'CRM type'}</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={draft.type}
                onChange={(e) => onField('type', e.target.value)}
                data-testid="mi-draft-type"
              >
                {CAMPAIGN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">{fr ? 'Objectif' : 'Objective'}</span>
              <Input
                value={draft.objective}
                onChange={(e) => onField('objective', e.target.value)}
                data-testid="mi-draft-objective"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              {fr ? 'Segment' : 'Segment'}: <span className="font-mono">{draft.targetSegmentKey}</span> ·{' '}
              {fr ? 'Effectif' : 'Headcount'}: {draft.audienceHeadcount}
            </p>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">{fr ? 'Message' : 'Message'}</span>
              <textarea
                className="min-h-[6rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={draft.message}
                onChange={(e) => onField('message', e.target.value.slice(0, 2000))}
                data-testid="mi-draft-message"
                maxLength={2000}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">{fr ? 'Appel à l’action' : 'Call to action'}</span>
              <Input
                value={draft.callToAction}
                onChange={(e) => onField('callToAction', e.target.value)}
                data-testid="mi-draft-cta"
                maxLength={200}
              />
            </label>
            {draft.messageVariants.length > 0 ? (
              <div className="space-y-1 text-xs">
                <p className="font-medium text-foreground/80">
                  {fr ? 'Variantes template' : 'Template variants'}
                </p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {draft.messageVariants.map((v) => (
                    <li key={v}>
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() => onField('message', v)}
                      >
                        {v}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {errors.length > 0 ? (
              <ul className="list-inside list-disc text-xs text-red-200" data-testid="mi-draft-errors" role="alert">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            {savedHint ? (
              <p className="text-xs text-amber-100" data-testid="mi-draft-local-ok">
                {savedHint}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={onValidate} data-testid="mi-draft-validate">
                {fr ? 'Valider le brouillon' : 'Validate draft'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setErrors([]);
                  setSavedHint(null);
                }}
              >
                {fr ? 'Fermer' : 'Close'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
