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

export function detectMiIntent(message: string): MiIntent {
  const text = message.trim();
  if (SEND_RE.test(text)) return 'send_blocked';
  if (TOP_CLIENTS_RE.test(text)) return 'top_clients';
  if (TOP_PRODUCTS_RE.test(text)) return 'top_products';
  if (INACTIVE_RE.test(text)) return 'inactive';
  if (/\b(aper[cç]u|overview|r[eé]sum[eé]|kpi|chiffres?|performance)\b/i.test(text)) {
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
