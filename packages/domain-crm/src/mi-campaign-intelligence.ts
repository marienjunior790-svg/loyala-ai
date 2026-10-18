/**
 * Marketing Intelligence P3 — propositions de campagne & brouillons éphémères.
 * Déterministe, lecture seule. Aucune écriture `campaigns` / envoi externe.
 *
 * Persist / schedule / WhatsApp : HORS PÉRIMÈTRE — exigerait `clients:write`
 * (pas de `campaigns:write` IAM aujourd’hui) + action createCampaign distincte.
 */
import { CAMPAIGN_TYPES, type CampaignType } from './campaigns';
import type { ClientSegment } from './segments';
import type { MiDataQuality, MiInactiveClient, MiPeriodMeta, MiTopClient } from './mi-tools';
import type { MiRetentionStrategy } from './mi-customer-intelligence';
import type { ProductStat } from './client-dashboard';

export type MiCampaignProposalPriority = 'high' | 'medium' | 'low';
export type MiCampaignDraftSource = 'template' | 'user_edited' | 'ai_draft';

export type MiCampaignObjectiveId =
  | 'reactivate_inactive'
  | 'nurture_at_risk'
  | 'thank_regular'
  | 'encourage_second_purchase'
  | 'recognize_vip'
  | 'promote_top_product'
  | 'recognize_top_spenders';

export interface MiCampaignProposal {
  id: string;
  objectiveId: MiCampaignObjectiveId;
  /** Type campagne CRM existant (réutilise CAMPAIGN_TYPES). */
  campaignType: CampaignType;
  priority: MiCampaignProposalPriority;
  objective: string;
  analyticalJustification: string[];
  period: Pick<MiPeriodMeta, 'code' | 'label' | 'from' | 'to'>;
  targetingCriteria: string;
  /** Segment CRM ou clé MI (ex. top_spenders_period). */
  targetSegmentKey: ClientSegment | 'top_spenders_period' | 'new_period' | 'product_buyers';
  /** Effectif réel disponible (0 = audience vide, pas inventée). */
  audienceHeadcount: number;
  suggestedName: string;
  suggestedMessage: string;
  suggestedCta: string;
  messageVariants: string[];
  limits: string[];
  /** Provenance : règles retention / opportunités / top produits. */
  sourceRefs: string[];
  rankScore: number;
}

/** Brouillon local — miroir des champs CreateCampaignInput + message, sans id DB. */
export interface MiCampaignDraft {
  /** Identifiant éphémère UI (pas un UUID campagne). */
  draftId: string;
  proposalId: string | null;
  name: string;
  type: CampaignType;
  objective: string;
  targetSegmentKey: string;
  targetingCriteria: string;
  audienceHeadcount: number;
  message: string;
  callToAction: string;
  messageVariants: string[];
  /** Toujours draft tant que P3 n’écrit pas en base. */
  status: 'draft';
  contentSource: MiCampaignDraftSource;
  /** Marqueur explicite pour l’UI. */
  isDraftOnly: true;
  /** Rappel : aucune persistence / envoi depuis MI. */
  persistenceNote: string;
  period: Pick<MiPeriodMeta, 'code' | 'label' | 'from' | 'to'>;
  limits: string[];
}

export interface MiCampaignDraftValidation {
  ok: boolean;
  errors: string[];
}

function priorityRank(p: MiCampaignProposalPriority): number {
  if (p === 'high') return 300;
  if (p === 'medium') return 200;
  return 100;
}

function periodSlice(period: MiPeriodMeta): Pick<MiPeriodMeta, 'code' | 'label' | 'from' | 'to'> {
  return { code: period.code, label: period.label, from: period.from, to: period.to };
}

const PERSISTENCE_NOTE =
  'Brouillon MI uniquement — non enregistré. La création persistée exige clients:write et le module Campagnes (hors P3).';

export interface BuildMiCampaignProposalsInput {
  period: MiPeriodMeta;
  dataQuality: MiDataQuality;
  restaurantName: string;
  currency: string;
  retentionStrategies: MiRetentionStrategy[];
  topProducts: Array<Pick<ProductStat, 'name' | 'quantity' | 'revenue' | 'clients'>>;
  /** Réservés pour extensions / traçabilité (non utilisés dans le ranking P3). */
  topClients: MiTopClient[];
  inactiveLoyal: MiInactiveClient[];
  segments: Record<ClientSegment, number> | null;
  clientCount: number;
}

/**
 * Propositions de campagne déterministes à partir de P1/P2 + top produits.
 * Audience = effectifs CRM réels ; jamais de ROI / conversion inventés.
 */
export function buildMiCampaignProposals(
  input: BuildMiCampaignProposalsInput
): MiCampaignProposal[] {
  if (input.clientCount === 0) return [];

  const { period, restaurantName, retentionStrategies, topProducts, dataQuality } = input;
  const p = periodSlice(period);
  const out: MiCampaignProposal[] = [];
  const byRule = new Map(retentionStrategies.map((s) => [s.ruleId, s]));

  const pushFromRetention = (
    ruleId: MiRetentionStrategy['ruleId'],
    objectiveId: MiCampaignObjectiveId,
    campaignType: CampaignType,
    nameTpl: string,
    messageTpl: (_s: MiRetentionStrategy) => string,
    cta: string,
    variants: (_s: MiRetentionStrategy) => string[]
  ) => {
    const s = byRule.get(ruleId);
    if (!s || s.headcount < 1) return;
    out.push({
      id: `campaign_${objectiveId}`,
      objectiveId,
      campaignType,
      priority: s.priority,
      objective: s.marketingObjective,
      analyticalJustification: [...s.facts, `Critères retention : ${s.selectionCriteria}`],
      period: p,
      targetingCriteria: s.selectionCriteria,
      targetSegmentKey: s.segmentKey,
      audienceHeadcount: s.headcount,
      suggestedName: nameTpl.replace('{resto}', restaurantName).replace('{n}', String(s.headcount)),
      suggestedMessage: messageTpl(s),
      suggestedCta: cta,
      messageVariants: variants(s),
      limits: [
        ...s.limits,
        'Message = brouillon template, pas un envoi.',
        'Aucun taux de conversion ni ROI estimé.',
      ],
      sourceRefs: [`retention:${s.ruleId}`],
      rankScore: priorityRank(s.priority) + Math.min(40, s.headcount) + s.rankScore * 0.01,
    });
  };

  pushFromRetention(
    'reactivate_inactive',
    'reactivate_inactive',
    'inactive',
    'Réactivation — {resto}',
    (s) =>
      `Bonjour ! On ne vous a pas vu depuis un moment chez ${restaurantName}. On serait ravis de vous accueillir à nouveau — dites-nous ce qui vous ferait plaisir.`,
    'Revenez nous voir cette semaine',
    (s) => [
      `Ça nous manque de vous servir chez ${restaurantName}. Une table vous attend quand vous voulez.`,
      `Petit rappel amical de ${restaurantName} : vos plats préférés sont toujours là. On vous réserve un bon accueil.`,
    ]
  );

  pushFromRetention(
    'nurture_at_risk',
    'nurture_at_risk',
    'inactive',
    'Retour at_risk — {resto}',
    () =>
      `Hello ! Juste un mot de ${restaurantName} pour rester en contact. Passez quand vous voulez — on a hâte de vous revoir.`,
    'Passez nous voir bientôt',
    () => [
      `On pense à vous chez ${restaurantName}. Une visite légère pour se faire plaisir ?`,
    ]
  );

  pushFromRetention(
    'thank_regular',
    'thank_regular',
    'loyalty',
    'Merci clients réguliers — {resto}',
    () =>
      `Merci de votre fidélité chez ${restaurantName} ! Votre présence compte beaucoup pour nous.`,
    'À très bientôt',
    () => [
      `Un grand merci de ${restaurantName} — vous faites partie de nos habitués, et ça se sent.`,
    ]
  );

  pushFromRetention(
    'encourage_second_purchase',
    'encourage_second_purchase',
    'loyalty',
    '2e visite — {resto}',
    () =>
      `Ravi de vous avoir accueilli chez ${restaurantName} ! On espère vous revoir bientôt pour une deuxième visite.`,
    'Revenez pour un 2e passage',
    () => [
      `Merci pour votre première visite chez ${restaurantName}. La porte est ouverte pour la suite.`,
    ]
  );

  pushFromRetention(
    'recognize_vip',
    'recognize_vip',
    'loyalty',
    'Remerciement VIP — {resto}',
    () =>
      `Chère cliente, cher client : un merci particulier de toute l’équipe ${restaurantName} pour votre confiance.`,
    'Merci — à bientôt',
    () => [
      `Vous comptez parmi nos clients les plus proches de ${restaurantName}. Merci du fond du cœur.`,
    ]
  );

  pushFromRetention(
    'recognize_top_spenders_period',
    'recognize_top_spenders',
    'loyalty',
    'Top période — {resto}',
    (s) =>
      `Merci pour votre soutien sur la période « ${period.label} » chez ${restaurantName}. Votre présence nous encourage.`,
    'Merci pour cette période',
    () => [
      `Un message de gratitude de ${restaurantName} pour votre activité récente. À très vite.`,
    ]
  );

  // Produit phare — uniquement si données période fiables + volume minimal
  const top = topProducts[0];
  if (dataQuality !== 'insufficient' && top && top.quantity >= 3 && top.revenue > 0) {
    out.push({
      id: 'campaign_promote_top_product',
      objectiveId: 'promote_top_product',
      campaignType: 'promotion',
      priority: top.quantity >= 10 ? 'medium' : 'low',
      objective: `Valoriser le produit le plus vendu de la période (« ${top.name} »).`,
      analyticalJustification: [
        `Top produit période : ${top.name}`,
        `Quantité : ${top.quantity}`,
        `CA lignes : ${Math.round(top.revenue).toLocaleString('fr-FR')} ${input.currency}`,
        `Clients distincts (si dispo) : ${top.clients}`,
      ],
      period: p,
      targetingCriteria:
        'Audience non listée client-par-client : suggestion promotionnelle basée sur topProducts dashboard (pas une liste d’acheteurs exportée).',
      targetSegmentKey: 'product_buyers',
      audienceHeadcount: top.clients > 0 ? top.clients : 0,
      suggestedName: `Focus ${top.name} — ${restaurantName}`,
      suggestedMessage: `Envie de ${top.name} ? C’est l’un des plus demandés chez ${restaurantName} en ce moment.`,
      suggestedCta: `Goûter ${top.name}`,
      messageVariants: [
        `Le ${top.name} cartonne chez ${restaurantName} — venez goûter (ou re-goûter) !`,
        `${restaurantName} vous recommande ${top.name}, parmi nos meilleures ventes de la période.`,
      ],
      limits: [
        'audienceHeadcount = clients distincts du produit sur la période (0 si non fourni) — pas une audience inventée.',
        'Pas de marge / ROI / prévision de ventes.',
        dataQuality === 'partial' ? 'dataQuality partial : volumes produit à interpréter avec prudence.' : '',
      ].filter(Boolean),
      sourceRefs: ['topProducts:0'],
      rankScore: priorityRank(top.quantity >= 10 ? 'medium' : 'low') + Math.min(30, top.quantity),
    });
  }

  return out.sort((a, b) => b.rankScore - a.rankScore || a.id.localeCompare(b.id));
}

/** Construit un brouillon éphémère depuis une proposition (éditable en UI). */
export function buildMiCampaignDraftFromProposal(
  proposal: MiCampaignProposal,
  overrides?: Partial<
    Pick<MiCampaignDraft, 'name' | 'message' | 'callToAction' | 'messageVariants' | 'contentSource'>
  >
): MiCampaignDraft {
  return {
    draftId: `local_${proposal.id}`,
    proposalId: proposal.id,
    name: overrides?.name ?? proposal.suggestedName,
    type: proposal.campaignType,
    objective: proposal.objective,
    targetSegmentKey: proposal.targetSegmentKey,
    targetingCriteria: proposal.targetingCriteria,
    audienceHeadcount: proposal.audienceHeadcount,
    message: overrides?.message ?? proposal.suggestedMessage,
    callToAction: overrides?.callToAction ?? proposal.suggestedCta,
    messageVariants: overrides?.messageVariants ?? [...proposal.messageVariants],
    status: 'draft',
    contentSource: overrides?.contentSource ?? 'template',
    isDraftOnly: true,
    persistenceNote: PERSISTENCE_NOTE,
    period: { ...proposal.period },
    limits: [...proposal.limits],
  };
}

/** Applique des modifications utilisateur ; marque user_edited. */
export function applyMiCampaignDraftEdits(
  draft: MiCampaignDraft,
  edits: Partial<Pick<MiCampaignDraft, 'name' | 'type' | 'message' | 'callToAction' | 'messageVariants' | 'objective'>>
): MiCampaignDraft {
  return {
    ...draft,
    ...edits,
    messageVariants: edits.messageVariants ?? draft.messageVariants,
    contentSource: 'user_edited',
    status: 'draft',
    isDraftOnly: true,
    persistenceNote: PERSISTENCE_NOTE,
  };
}

/** Validation alignée sur les contraintes createCampaign (name + type). */
export function validateMiCampaignDraft(draft: Partial<MiCampaignDraft>): MiCampaignDraftValidation {
  const errors: string[] = [];
  const name = typeof draft.name === 'string' ? draft.name.trim() : '';
  if (!name) errors.push('Le nom de campagne est requis.');
  if (name.length > 120) errors.push('Le nom ne peut pas dépasser 120 caractères.');

  const type = draft.type;
  if (!type || !(CAMPAIGN_TYPES as readonly string[]).includes(type)) {
    errors.push(`Type invalide — attendu l’un de : ${CAMPAIGN_TYPES.join(', ')}.`);
  }

  const message = typeof draft.message === 'string' ? draft.message.trim() : '';
  if (!message) errors.push('Le message brouillon est requis.');
  if (message.length > 2000) errors.push('Le message ne peut pas dépasser 2000 caractères.');

  const cta = typeof draft.callToAction === 'string' ? draft.callToAction.trim() : '';
  if (cta.length > 200) errors.push('L’appel à l’action ne peut pas dépasser 200 caractères.');

  if (typeof draft.audienceHeadcount === 'number' && draft.audienceHeadcount < 0) {
    errors.push('L’effectif audience ne peut pas être négatif.');
  }

  return { ok: errors.length === 0, errors };
}

/** Payload sûr pour prompt IA (brouillon) — pas de téléphones. */
export function miCampaignDraftForPrompt(draft: MiCampaignDraft): Record<string, unknown> {
  return {
    draftId: draft.draftId,
    proposalId: draft.proposalId,
    name: draft.name,
    type: draft.type,
    objective: draft.objective,
    targetSegmentKey: draft.targetSegmentKey,
    targetingCriteria: draft.targetingCriteria,
    audienceHeadcount: draft.audienceHeadcount,
    message: draft.message,
    callToAction: draft.callToAction,
    messageVariants: draft.messageVariants,
    status: draft.status,
    contentSource: draft.contentSource,
    isDraftOnly: true,
    persistenceNote: draft.persistenceNote,
    period: draft.period,
    limits: draft.limits,
  };
}
