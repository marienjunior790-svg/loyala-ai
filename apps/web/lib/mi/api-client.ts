import { MI_CHAT_MAX_ANSWER_CHARS, type MiChatRequest } from '@loyala/validation';
import { miHttpErrorMessage, type MiLocale } from './ui-copy';

/** Timeout client aligné sur les appels worker existants (~60s). */
export const MI_CHAT_REQUEST_TIMEOUT_MS = 60_000;

/** Historique envoyé au serveur : max 10 tours (contrat Zod). */
export const MI_HISTORY_MAX_TURNS = 10;
export const MI_HISTORY_CONTENT_MAX = 4000;
export const MI_MESSAGE_MAX = 2000;

export interface MiChatApiPeriod {
  code: string;
  label: string;
  from: string;
  to: string;
  definition: string;
}

export interface MiChatApiMeta {
  requestId: string | null;
  model: string | null;
  cached: boolean;
  latencyMs: number;
  skippedAi: boolean;
}

export interface MiChatApiSuccess {
  ok: true;
  answer: string;
  intent: string;
  dataQuality: 'ok' | 'partial' | 'insufficient';
  period: MiChatApiPeriod;
  toolsUsed: string[];
  insights: Record<string, unknown>;
  meta: MiChatApiMeta;
}

export interface MiChatApiFailure {
  ok: false;
  status: number;
  code: string | null;
  message: string;
  dataQuality: 'ok' | 'partial' | 'insufficient' | null;
}

export type MiChatApiResult = MiChatApiSuccess | MiChatApiFailure;

export function clampHistoryForApi(
  history: { role: 'user' | 'assistant'; content: string }[]
): MiChatRequest['history'] {
  return history.slice(-MI_HISTORY_MAX_TURNS).map((h) => ({
    role: h.role,
    content: h.content.slice(0, MI_HISTORY_CONTENT_MAX),
  }));
}

export function clampMessage(message: string): string {
  return message.trim().slice(0, MI_MESSAGE_MAX);
}

function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asPeriod(raw: unknown): MiChatApiPeriod {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    code: typeof o.code === 'string' ? o.code : '',
    label: typeof o.label === 'string' ? o.label : '',
    from: typeof o.from === 'string' ? o.from : '',
    to: typeof o.to === 'string' ? o.to : '',
    definition: typeof o.definition === 'string' ? o.definition : '',
  };
}

function asMeta(raw: unknown): MiChatApiMeta {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    requestId: typeof o.requestId === 'string' ? o.requestId : null,
    model: typeof o.model === 'string' ? o.model : null,
    cached: Boolean(o.cached),
    latencyMs: typeof o.latencyMs === 'number' ? o.latencyMs : 0,
    skippedAi: Boolean(o.skippedAi),
  };
}

function asDataQuality(raw: unknown): MiChatApiSuccess['dataQuality'] {
  if (raw === 'ok' || raw === 'partial' || raw === 'insufficient') return raw;
  return 'partial';
}

/**
 * Appelle exclusivement POST /api/mi/chat.
 * Pas de simulation de réponse ; pas de chiffres fabriqués côté client.
 */
export async function postMiChat(
  body: {
    message: string;
    locale: MiLocale;
    period?: MiChatRequest['period'];
    history: { role: 'user' | 'assistant'; content: string }[];
  },
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch }
): Promise<MiChatApiResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const payload: MiChatRequest = {
    message: clampMessage(body.message),
    locale: body.locale,
    history: clampHistoryForApi(body.history),
    period: body.period,
  };

  if (!payload.message) {
    return {
      ok: false,
      status: 400,
      code: 'validation_error',
      message: miHttpErrorMessage(400, 'validation_error', null, body.locale),
      dataQuality: null,
    };
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MI_CHAT_REQUEST_TIMEOUT_MS);
    const external = options?.signal;
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      res = await fetchImpl('/api/mi/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === 'AbortError') ||
      (typeof error === 'object' && error !== null && 'name' in error && (error as { name: string }).name === 'AbortError');
    if (aborted) {
      return {
        ok: false,
        status: 504,
        code: 'ai_timeout',
        message: miHttpErrorMessage(504, 'ai_timeout', null, body.locale),
        dataQuality: null,
      };
    }
    return {
      ok: false,
      status: 0,
      code: 'network_error',
      message: miHttpErrorMessage(0, 'network_error', null, body.locale),
      dataQuality: null,
    };
  }

  const text = await res.text();
  const json = parseJsonSafe(text);

  if (!res.ok) {
    const code = typeof json?.code === 'string' ? json.code : null;
    const serverMessage = typeof json?.error === 'string' ? json.error : null;
    const dq =
      json?.dataQuality === 'ok' || json?.dataQuality === 'partial' || json?.dataQuality === 'insufficient'
        ? json.dataQuality
        : null;
    return {
      ok: false,
      status: res.status,
      code,
      message: miHttpErrorMessage(res.status, code, serverMessage, body.locale),
      dataQuality: dq,
    };
  }

  if (!json || typeof json.answer !== 'string') {
    return {
      ok: false,
      status: 502,
      code: 'ai_error',
      message: miHttpErrorMessage(502, 'ai_error', null, body.locale),
      dataQuality: null,
    };
  }

  const answer =
    json.answer.length > MI_CHAT_MAX_ANSWER_CHARS
      ? `${json.answer.slice(0, MI_CHAT_MAX_ANSWER_CHARS - 1)}…`
      : json.answer;

  return {
    ok: true,
    answer,
    intent: typeof json.intent === 'string' ? json.intent : 'general',
    dataQuality: asDataQuality(json.dataQuality),
    period: asPeriod(json.period),
    toolsUsed: Array.isArray(json.toolsUsed)
      ? json.toolsUsed.filter((t): t is string => typeof t === 'string')
      : [],
    insights:
      json.insights && typeof json.insights === 'object' && !Array.isArray(json.insights)
        ? (json.insights as Record<string, unknown>)
        : {},
    meta: asMeta(json.meta),
  };
}
