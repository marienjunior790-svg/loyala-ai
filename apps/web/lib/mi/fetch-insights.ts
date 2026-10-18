import type { MiChatRequest } from '@loyala/validation';
import { miHttpErrorMessage, type MiLocale } from './ui-copy';
import type { MiChatApiPeriod } from './api-client';

export const MI_INSIGHTS_TIMEOUT_MS = 45_000;

export interface MiInsightsApiSuccess {
  ok: true;
  dataQuality: 'ok' | 'partial' | 'insufficient';
  period: MiChatApiPeriod;
  insights: Record<string, unknown>;
  toolsUsed: string[];
}

export interface MiInsightsApiFailure {
  ok: false;
  status: number;
  code: string | null;
  message: string;
  dataQuality: 'ok' | 'partial' | 'insufficient' | null;
}

export type MiInsightsApiResult = MiInsightsApiSuccess | MiInsightsApiFailure;

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

function asDataQuality(raw: unknown): MiInsightsApiSuccess['dataQuality'] {
  if (raw === 'ok' || raw === 'partial' || raw === 'insufficient') return raw;
  return 'partial';
}

/** GET /api/mi/insights — lecture seule, pas de simulation côté client. */
export async function fetchMiInsights(
  period: NonNullable<MiChatRequest['period']>,
  locale: MiLocale,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch }
): Promise<MiInsightsApiResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const qs = new URLSearchParams({ period });

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MI_INSIGHTS_TIMEOUT_MS);
    const external = options?.signal;
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      res = await fetchImpl(`/api/mi/insights?${qs.toString()}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === 'AbortError') ||
      (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name: string }).name === 'AbortError');
    if (aborted) {
      return {
        ok: false,
        status: 504,
        code: 'ai_timeout',
        message: miHttpErrorMessage(504, 'ai_timeout', null, locale),
        dataQuality: null,
      };
    }
    return {
      ok: false,
      status: 0,
      code: 'network_error',
      message: miHttpErrorMessage(0, 'network_error', null, locale),
      dataQuality: null,
    };
  }

  const text = await res.text();
  const json = parseJsonSafe(text);

  if (!res.ok) {
    const code = typeof json?.code === 'string' ? json.code : null;
    const serverMessage = typeof json?.error === 'string' ? json.error : null;
    const dq =
      json?.dataQuality === 'ok' ||
      json?.dataQuality === 'partial' ||
      json?.dataQuality === 'insufficient'
        ? json.dataQuality
        : null;
    return {
      ok: false,
      status: res.status,
      code,
      message: miHttpErrorMessage(res.status, code, serverMessage, locale),
      dataQuality: dq,
    };
  }

  if (!json || !json.insights || typeof json.insights !== 'object') {
    return {
      ok: false,
      status: 502,
      code: 'data_error',
      message: miHttpErrorMessage(502, 'data_error', null, locale),
      dataQuality: null,
    };
  }

  return {
    ok: true,
    dataQuality: asDataQuality(json.dataQuality),
    period: asPeriod(json.period),
    insights: json.insights as Record<string, unknown>,
    toolsUsed: Array.isArray(json.toolsUsed)
      ? json.toolsUsed.filter((t): t is string => typeof t === 'string')
      : [],
  };
}
