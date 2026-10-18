/**
 * Marketing Intelligence — tour de chat L2 (consultatif).
 * Aucune persistence, aucun effet externe, orgId uniquement depuis la session.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { orchestrateAI, type AIResponse } from '@loyala/core-ai';
import {
  loadMiOrgInsights,
  miInsightsForPrompt,
  resolveMiPeriod,
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

const SEND_RE =
  /\b(envoie[rz]?|envoy(er|ez)|lancer|lance[rz]?|publie[rz]?|publier|whatsapp|sms|email|e-?mail|campagne|diffuser|envoyer)\b/i;

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

export function detectMiIntent(message: string): MiIntent {
  const text = message.trim();
  if (SEND_RE.test(text)) return 'send_blocked';
  if (TOP_CLIENTS_RE.test(text)) return 'top_clients';
  if (TOP_PRODUCTS_RE.test(text)) return 'top_products';
  if (INACTIVE_RE.test(text)) return 'inactive';
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

  // Fidélisation / opportunités segments : possibles même sans commandes payées période.
  const deterministic = buildDeterministicEnrichmentAnswer(intent, insights);
  if (deterministic && (intent === 'retention' || intent === 'opportunities' || intent === 'trends')) {
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
