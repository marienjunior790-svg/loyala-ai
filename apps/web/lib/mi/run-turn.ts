/**
 * Marketing Intelligence — tour de chat L2 (consultatif).
 * Aucune persistence, aucun effet externe, orgId uniquement depuis la session.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { orchestrateAI, type AIResponse } from '@loyala/core-ai';
import {
  deriveBomayeSignalsFromCrm,
  evaluateBomayeAdvisor,
  formatBomayeAdvisorAnswer,
  getBomayePackSummary,
  isBomayeKnowledgeIntent,
  mergeBomayeSignalSources,
  parseBomayeSignalsFromMessage,
  selectBomayeKnowledgeSlice,
  loadMiOrgInsights,
  miInsightsForPrompt,
  resolveMiPeriod,
  type BomayeAdvisorSignals,
  type MiDataQuality,
  type MiOrgInsights,
} from '@loyala/domain-crm';
import { MI_CHAT_MAX_ANSWER_CHARS } from '@loyala/validation';

export type MiIntent =
  | 'top_clients'
  | 'top_products'
  | 'inactive'
  | 'overview'
  | 'trends'
  | 'opportunities'
  | 'retention'
  | 'campaign'
  | 'knowledge'
  | 'send_blocked'
  | 'general';

export type MiChatErrorCode =
  | 'validation_error'
  | 'ai_timeout'
  | 'ai_quota'
  | 'ai_error'
  | 'data_error';

export interface MiChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface MiChatTurnSuccess {
  ok: true;
  answer: string;
  intent: MiIntent;
  dataQuality: MiDataQuality;
  period: MiOrgInsights['period'];
  toolsUsed: string[];
  /** Snapshot borné pour le client (pas de tél. complet). */
  insights: ReturnType<typeof miInsightsForPrompt>;
  meta: {
    requestId: string | null;
    model: string | null;
    cached: boolean;
    latencyMs: number;
    skippedAi: boolean;
  };
}

export interface MiChatTurnFailure {
  ok: false;
  code: MiChatErrorCode;
  message: string;
  dataQuality?: MiDataQuality;
}

export type MiChatTurnResult = MiChatTurnSuccess | MiChatTurnFailure;

export type MiOrchestrateFn = (input: {
  tenantId: string;
  userId?: string;
  promptKey: 'marketing.assistant.answer';
  variables: Record<string, unknown>;
  skipCache?: boolean;
  maxTokens?: number;
  temperature?: number;
}) => Promise<AIResponse>;

/**
 * Envoi / diffusion réelle (impératif).
 * Exclut les questions exploratoires (« dois-je lancer… », conseil Bomaye).
 * Pas le simple mot « campagne » / « WhatsApp » seul.
 */
const SEND_RE =
  /\b(envoie[rz]?|envoy(er|ez)|publie[rz]?|publier|diffuser|envoyer)\b/i;
/** Lancer/lance — filtré ensuite si question exploratoire. */
const SEND_LAUNCH_RE = /\b(lancer|lance[rz]?)\b/i;

const TOP_CLIENTS_RE =
  /\b(meilleurs?\s+clients?|top\s*clients?|clients?\s+(vip|fid[eè]les?)|classement\s+clients?|plus\s+(gros|grands?)\s+(d[eé]pens|clients?))\b/i;

const TOP_PRODUCTS_RE =
  /\b(meilleurs?\s+produits?|top\s*produits?|plats?\s+populaires?|plus\s+vendus?|produits?\s+phares?)\b/i;

const INACTIVE_RE =
  /\b(inactifs?|dormants?|ne\s+revien|à\s+risque|at[_ ]?risk|relancer|réactiver)\b/i;

const TRENDS_RE =
  /\b(tendance|tendances|évolution|evolut|compar(e|aison)|hausse|baisse|vs\s+précéd|par\s+rapport)\b/i;

const OPPORTUNITIES_RE =
  /\b(opportunit|recommandation|priorit[eé]|que\s+faire|actions?\s+sugg[eé]r|alertes?)\b/i;

const RETENTION_RE =
  /\b(fid[eé]lis|r[eé]tention|segments?\s+(m[eé]ritent|[aà]\s+action|prioritaires)|encourager.*(nouveaux|revenir)|quels?\s+clients?\s+(dois|faut)|priorit[eé].*fid[eé]l)\b/i;

const CAMPAIGN_RE =
  /\b(campagne|brouillon\s+(de\s+)?(campagne|message)|proposition\s+de\s+campagne|id[eé]e\s+de\s+campagne|pr[eé]parer\s+(une\s+)?campagne|draft\s+campaign|quel\s+message\s+(envoyer|r[eé]diger))\b/i;

function isSendBlockedIntent(text: string): boolean {
  if (SEND_RE.test(text)) return true;
  // « Lance la campagne » / « Lancer maintenant » — pas « Dois-je lancer une campagne ? »
  if (/\b(dois[- ]je|faut[- ]il|devrais[- ]je|peut[- ]on|devons[- ]nous|puis[- ]je)\b/i.test(text)) {
    return false;
  }
  return SEND_LAUNCH_RE.test(text);
}

export function detectMiIntent(message: string): MiIntent {
  const text = message.trim();
  // Conseil Bomaye avant blocage d’envoi si la question est stratégique
  // (ex. « dois-je lancer une campagne alors que mes avis baissent ? »).
  if (isBomayeKnowledgeIntent(text)) {
    if (isSendBlockedIntent(text) && !/\b(dois[- ]je|faut[- ]il|devrais[- ]je)\b/i.test(text)) {
      return 'send_blocked';
    }
    return 'knowledge';
  }
  if (isSendBlockedIntent(text)) return 'send_blocked';
  if (TOP_CLIENTS_RE.test(text)) return 'top_clients';
  if (TOP_PRODUCTS_RE.test(text)) return 'top_products';
  if (INACTIVE_RE.test(text)) return 'inactive';
  if (CAMPAIGN_RE.test(text)) return 'campaign';
  if (RETENTION_RE.test(text)) return 'retention';
  if (OPPORTUNITIES_RE.test(text)) return 'opportunities';
  if (TRENDS_RE.test(text)) return 'trends';
  if (/\b(aper[cç]u|overview|r[eé]sum[eé]|kpi|chiffres?|performance|cockpit)\b/i.test(text)) {
    return 'overview';
  }
  return 'general';
}

function toolsForIntent(intent: MiIntent): string[] {
  switch (intent) {
    case 'top_clients':
      return ['loadMiOrgInsights', 'listTopClientsFromDashboard'];
    case 'top_products':
      return ['loadMiOrgInsights', 'listPopularProductsFromDashboard'];
    case 'inactive':
      return ['loadMiOrgInsights', 'listInactiveLoyalClients'];
    case 'trends':
      return ['loadMiOrgInsights', 'buildMiTrends'];
    case 'opportunities':
      return ['loadMiOrgInsights', 'buildMiOpportunities'];
    case 'retention':
      return ['loadMiOrgInsights', 'buildMiRetentionStrategies', 'buildMiCustomerIntelligence'];
    case 'campaign':
      return ['loadMiOrgInsights', 'buildMiCampaignProposals'];
    case 'knowledge':
      return [
        'loadMiOrgInsights',
        'deriveBomayeSignalsFromCrm',
        'mergeBomayeSignalSources',
        'evaluateBomayeAdvisor',
        'bomayeKnowledgePack',
      ];
    case 'send_blocked':
      return [];
    case 'overview':
    case 'general':
    default:
      return ['loadMiOrgInsights'];
  }
}

function truncateAnswer(text: string): string {
  if (text.length <= MI_CHAT_MAX_ANSWER_CHARS) return text;
  return `${text.slice(0, MI_CHAT_MAX_ANSWER_CHARS - 1)}…`;
}

function buildInsufficientAnswer(insights: MiOrgInsights): string {
  const reasons = insights.limits.length
    ? insights.limits.map((l) => `• ${l}`).join('\n')
    : '• Données insuffisantes pour produire une analyse fiable.';
  return [
    `Je ne peux pas fournir de statistiques fiables pour la période « ${insights.period.label} » (${insights.period.from} → ${insights.period.to}).`,
    '',
    'Qualité des données : insufficient',
    reasons,
    '',
    'Aucun chiffre n’a été inventé. Ajoutez des commandes payées ou élargissez la période, puis réessayez.',
  ].join('\n');
}

function buildSendBlockedAnswer(): string {
  return [
    'Je suis en mode consultatif (Phase 1) : je peux analyser vos données et préparer un brouillon,',
    'mais je ne peux pas envoyer de WhatsApp, d’e-mail, ni lancer de campagne.',
    'Reformulez votre question autour des clients, produits ou segments, et je m’appuierai sur vos données réelles.',
  ].join(' ');
}

/** Réponse déterministe tendances / opportunités (évite LLM si le payload suffit). */
function buildDeterministicEnrichmentAnswer(
  intent: MiIntent,
  insights: MiOrgInsights
): string | null {
  if (intent === 'trends' && insights.trends) {
    const t = insights.trends;
    const line = (label: string, point: { current: number; previous: number; changePct: number | null; significant: boolean }) => {
      const pct =
        point.changePct === null ? 'n/d' : `${point.changePct > 0 ? '+' : ''}${point.changePct} %`;
      const sig = point.significant ? 'significatif' : 'non significatif (seuil/volume)';
      return `• ${label} : ${Math.round(point.current)} vs ${Math.round(point.previous)} (${pct}, ${sig})`;
    };
    return [
      `Tendances « ${insights.period.label} » (${insights.period.from} → ${insights.period.to}).`,
      t.comparisonNote,
      '',
      line('CA', t.revenue),
      line('Visites', t.visits),
      line('Clients servis', t.clientsServed),
      line('Panier moyen', t.averageBasket),
      line('Nouveaux clients', t.newClients),
      '',
      'Ces variations sont des faits CRM ; elles n’établissent pas une cause.',
    ].join('\n');
  }

  if (intent === 'opportunities') {
    if (insights.opportunities.length === 0) {
      return [
        `Aucune opportunité déterministe déclenchée pour « ${insights.period.label} » (${insights.period.from} → ${insights.period.to}).`,
        'Les seuils de volume ou de variation n’ont pas été atteints — aucun signal inventé.',
      ].join('\n');
    }
    const blocks = insights.opportunities.slice(0, 5).map((op, i) => {
      return [
        `${i + 1}. [${op.priority}] ${op.ruleId}`,
        `Faits : ${op.facts.join(' | ')}`,
        `Règle : ${op.detectionRule}`,
        `Limites : ${op.limits.join(' ')}`,
        `Action suggérée : ${op.suggestedAction}`,
      ].join('\n');
    });
    return [
      `Opportunités classées (règles déterministes) — période ${insights.period.from} → ${insights.period.to}.`,
      '',
      ...blocks,
    ].join('\n\n');
  }

  if (intent === 'retention') {
    const strategies = insights.retentionStrategies ?? [];
    const segNote = insights.customerIntelligence?.segments
      ? `Segments (instantané) : ${Object.entries(insights.customerIntelligence.segments.counts)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}. ${insights.customerIntelligence.segments.evolutionNote}`
      : 'Snapshot segments indisponible.';
    if (strategies.length === 0) {
      return [
        `Aucune stratégie de fidélisation déterministe pour l’instant (${insights.period.from} → ${insights.period.to}).`,
        segNote,
        'Aucun impact ROI inventé — base clients vide ou critères non atteints.',
      ].join('\n');
    }
    const blocks = strategies.slice(0, 6).map((s, i) => {
      return [
        `${i + 1}. [${s.priority}/${s.confidence}] ${s.ruleId} — ${s.segmentKey} (n=${s.headcount})`,
        `Objectif : ${s.marketingObjective}`,
        `Critères : ${s.selectionCriteria}`,
        `Faits : ${s.facts.join(' | ')}`,
        `Action : ${s.suggestedAction}`,
        `Limites : ${s.limits.join(' ')}`,
      ].join('\n');
    });
    return [
      `Stratégies de fidélisation (déterministes) — période affichée ${insights.period.from} → ${insights.period.to}.`,
      segNote,
      '',
      ...blocks,
      '',
      'Confiance limitée : ce ne sont pas des prédictions de conversion.',
    ].join('\n\n');
  }

  if (intent === 'campaign') {
    const proposals = insights.campaignProposals ?? [];
    if (proposals.length === 0) {
      return [
        `Aucune proposition de campagne déterministe (${insights.period.from} → ${insights.period.to}).`,
        'Segments vides, critères non atteints, ou aucune commande pour valoriser un produit.',
        'Aucun ROI inventé. Les brouillons MI ne sont pas enregistrés en base.',
      ].join('\n');
    }
    const blocks = proposals.slice(0, 5).map((c, i) => {
      return [
        `${i + 1}. [${c.priority}] ${c.objectiveId} — type=${c.campaignType} (n=${c.audienceHeadcount})`,
        `Objectif : ${c.objective}`,
        `Ciblage : ${c.targetingCriteria}`,
        `Justification : ${c.analyticalJustification.join(' | ')}`,
        `Nom suggéré : ${c.suggestedName}`,
        `Message (brouillon) : ${c.suggestedMessage}`,
        `CTA : ${c.suggestedCta}`,
        `Limites : ${c.limits.join(' ')}`,
      ].join('\n');
    });
    return [
      `Propositions de campagne (déterministes, brouillons non persistés) — ${insights.period.from} → ${insights.period.to}.`,
      '',
      ...blocks,
      '',
      'Aucun envoi WhatsApp / e-mail. Pour créer une campagne CRM : module Campagnes + permission clients:write (hors MI P3).',
    ].join('\n\n');
  }

  return null;
}

function classifyAiError(error: unknown): MiChatTurnFailure {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('etimedout')) {
    return { ok: false, code: 'ai_timeout', message: 'Délai IA dépassé. Réessayez dans un instant.' };
  }
  if (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('exceeds limit') ||
    lower.includes('cost')
  ) {
    return { ok: false, code: 'ai_quota', message: 'Quota ou plafond de coût IA atteint.' };
  }
  return { ok: false, code: 'ai_error', message: 'Le service IA est temporairement indisponible.' };
}

export interface RunMiChatTurnInput {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  message: string;
  period?: string;
  history?: MiChatHistoryItem[];
  locale?: 'fr' | 'en';
  /** Injection tests — défaut orchestrateAI. */
  orchestrate?: MiOrchestrateFn;
  /** Injection tests — défaut loadMiOrgInsights. */
  loadInsights?: typeof loadMiOrgInsights;
  /**
   * Signaux Bomaye injectés (tests / outils internes).
   * Jamais lus depuis un body client non fiable sans validation — session org obligatoire.
   */
  bomayeSignals?: Partial<BomayeAdvisorSignals>;
}

/**
 * Exécute un tour MI : outils déterministes puis (si besoin) orchestrateAI.
 * organizationId doit provenir du contexte de session — jamais du corps client.
 */
export async function runMiChatTurn(input: RunMiChatTurnInput): Promise<MiChatTurnResult> {
  const message = input.message.trim();
  if (!message) {
    return { ok: false, code: 'validation_error', message: 'Message requis' };
  }

  const intent = detectMiIntent(message);
  const toolsUsed = toolsForIntent(intent);
  const periodHint = input.period ?? resolveMiPeriod(message);
  const loadInsights = input.loadInsights ?? loadMiOrgInsights;
  const orchestrate = input.orchestrate ?? (orchestrateAI as MiOrchestrateFn);

  if (intent === 'send_blocked') {
    return {
      ok: true,
      answer: buildSendBlockedAnswer(),
      intent,
      dataQuality: 'ok',
      period: {
        code: resolveMiPeriod(periodHint),
        label: '—',
        from: '',
        to: '',
        definition: 'Aucune lecture CRM pour une demande d’envoi.',
      },
      toolsUsed: [],
      insights: {
        dataQuality: 'ok',
        limits: ['Aucun effet externe — demande d’envoi refusée.'],
        topClients: [],
        topProducts: [],
      },
      meta: {
        requestId: null,
        model: null,
        cached: false,
        latencyMs: 0,
        skippedAi: true,
      },
    };
  }

  let insights: MiOrgInsights;
  try {
    insights = await loadInsights(input.supabase, input.organizationId, {
      period: periodHint,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur de lecture des données';
    return { ok: false, code: 'data_error', message: msg, dataQuality: 'insufficient' };
  }

  // Isolation : le snapshot doit porter l’org de session.
  if (insights.organizationId !== input.organizationId) {
    return {
      ok: false,
      code: 'data_error',
      message: 'Isolation organisation violée',
      dataQuality: 'insufficient',
    };
  }

  const promptPayload = miInsightsForPrompt(insights);
  promptPayload.bomayeKnowledge = getBomayePackSummary();

  // Conseil stratégique Bomaye (déterministe) — avant LLM.
  // P2.1 : pont CRM → Bomaye puis fusion avec déclarations message (CRM prime en conflit).
  if (intent === 'knowledge') {
    const crmBridge = deriveBomayeSignalsFromCrm(insights);
    const declared = parseBomayeSignalsFromMessage(message, {
      restaurantName: insights.restaurantName,
      ...input.bomayeSignals,
      dataOrigin:
        input.bomayeSignals?.dataOrigin ??
        (input.bomayeSignals ? 'synthetic_test' : 'user_declared'),
    });
    const merged = mergeBomayeSignalSources({ crm: crmBridge, declared });
    const advice = evaluateBomayeAdvisor(merged.signals, {
      fieldOrigins: merged.fieldOrigins,
      conflicts: merged.conflicts,
      crmFacts: merged.crmFacts,
      crmLimits: merged.crmLimits,
      miOpportunityRuleIds: merged.miOpportunityRuleIds,
    });
    const knowledgeSlice = selectBomayeKnowledgeSlice({
      strategyIds: advice.primaryStrategies,
      includeKpis: true,
      marketContext: merged.signals.marketContext ?? 'unknown',
    });
    promptPayload.bomayeAdvisor = {
      dataOrigin: advice.dataOrigin,
      fires: advice.fires.map((f) => ({
        ruleId: f.ruleId,
        priority: f.priority,
        recommendation: f.recommendation,
        strategies: f.strategies,
        provenance: f.provenance,
      })),
      missingInformation: advice.missingInformation,
      observedFacts: advice.observedFacts,
      primaryStrategies: advice.primaryStrategies,
      fieldOrigins: advice.fieldOrigins ?? merged.fieldOrigins,
      conflicts: advice.conflicts ?? merged.conflicts,
      crmBridge: {
        insufficientForTrends: crmBridge.insufficientForTrends,
        dataQuality: crmBridge.dataQuality,
        miOpportunityRuleIds: crmBridge.miOpportunityRuleIds,
        limits: crmBridge.limits,
      },
    };
    promptPayload.knowledgeRefs = knowledgeSlice;

    return {
      ok: true,
      answer: truncateAnswer(formatBomayeAdvisorAnswer(advice)),
      intent,
      dataQuality: insights.dataQuality,
      period: insights.period,
      toolsUsed,
      insights: promptPayload,
      meta: {
        requestId: null,
        model: null,
        cached: false,
        latencyMs: 0,
        skippedAi: true,
      },
    };
  }

  // Fidélisation / opportunités segments : possibles même sans commandes payées période.
  const deterministic = buildDeterministicEnrichmentAnswer(intent, insights);
  if (
    deterministic &&
    (intent === 'retention' ||
      intent === 'opportunities' ||
      intent === 'trends' ||
      intent === 'campaign')
  ) {
    return {
      ok: true,
      answer: truncateAnswer(deterministic),
      intent,
      dataQuality: insights.dataQuality,
      period: insights.period,
      toolsUsed,
      insights: promptPayload,
      meta: {
        requestId: null,
        model: null,
        cached: false,
        latencyMs: 0,
        skippedAi: true,
      },
    };
  }

  if (insights.dataQuality === 'insufficient') {
    return {
      ok: true,
      answer: buildInsufficientAnswer(insights),
      intent,
      dataQuality: 'insufficient',
      period: insights.period,
      toolsUsed,
      insights: promptPayload,
      meta: {
        requestId: null,
        model: null,
        cached: false,
        latencyMs: 0,
        skippedAi: true,
      },
    };
  }

  if (deterministic) {
    return {
      ok: true,
      answer: truncateAnswer(deterministic),
      intent,
      dataQuality: insights.dataQuality,
      period: insights.period,
      toolsUsed,
      insights: promptPayload,
      meta: {
        requestId: null,
        model: null,
        cached: false,
        latencyMs: 0,
        skippedAi: true,
      },
    };
  }

  const historySnippet =
    (input.history ?? [])
      .slice(-6)
      .map((h) => `${h.role}: ${h.content.slice(0, 500)}`)
      .join('\n') || '(aucun)';

  try {
    const ai = await orchestrate({
      tenantId: input.organizationId,
      userId: input.userId,
      promptKey: 'marketing.assistant.answer',
      variables: {
        message: `${message}\n\nHistorique récent:\n${historySnippet}`,
        toolResults: JSON.stringify(promptPayload),
        intent,
        dataQuality: insights.dataQuality,
      },
      skipCache: false,
      maxTokens: 700,
      temperature: 0.2,
    });

    return {
      ok: true,
      answer: truncateAnswer(ai.content?.trim() || 'Aucune réponse générée.'),
      intent,
      dataQuality: insights.dataQuality,
      period: insights.period,
      toolsUsed,
      insights: promptPayload,
      meta: {
        requestId: ai.requestId ?? null,
        model: ai.model ?? null,
        cached: Boolean(ai.cached),
        latencyMs: ai.latencyMs ?? 0,
        skippedAi: false,
      },
    };
  } catch (error) {
    return classifyAiError(error);
  }
}
