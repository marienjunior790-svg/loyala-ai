import { describe, expect, it, vi } from 'vitest';
import {
  clampHistoryForApi,
  clampMessage,
  MI_HISTORY_MAX_TURNS,
  MI_MESSAGE_MAX,
  postMiChat,
} from './api-client';

describe('clampHistoryForApi / clampMessage', () => {
  it('borne message et historique au contrat serveur', () => {
    expect(clampMessage('  hello  ')).toBe('hello');
    expect(clampMessage('x'.repeat(MI_MESSAGE_MAX + 50)).length).toBe(MI_MESSAGE_MAX);

    const history = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: 'c'.repeat(5000),
    }));
    const clamped = clampHistoryForApi(history);
    expect(clamped.length).toBe(MI_HISTORY_MAX_TURNS);
    expect(clamped.every((h) => h.content.length <= 4000)).toBe(true);
  });
});

describe('postMiChat', () => {
  it('mappe 401 / 403 / 429 / 502 / 504', async () => {
    const cases: Array<{ status: number; body: object; expectStatus: number; code?: string }> = [
      { status: 401, body: { error: 'Unauthorized', code: 'unauthorized' }, expectStatus: 401 },
      {
        status: 403,
        body: { error: 'Forbidden', code: 'forbidden', permission: 'analytics:read' },
        expectStatus: 403,
      },
      { status: 429, body: { error: 'Quota', code: 'ai_quota' }, expectStatus: 429, code: 'ai_quota' },
      { status: 502, body: { error: 'IA down', code: 'ai_error' }, expectStatus: 502 },
      { status: 504, body: { error: 'timeout', code: 'ai_timeout' }, expectStatus: 504 },
    ];

    for (const c of cases) {
      const fetchImpl = vi.fn(async () =>
        new Response(JSON.stringify(c.body), {
          status: c.status,
          headers: { 'content-type': 'application/json' },
        })
      );
      const result = await postMiChat(
        { message: 'test', locale: 'fr', history: [] },
        { fetchImpl: fetchImpl as unknown as typeof fetch }
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(c.expectStatus);
      expect(result.message.length).toBeGreaterThan(5);
      if (c.code) expect(result.code).toBe(c.code);
    }
  });

  it('parse une réponse succès sans inventer de chiffres', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          answer: 'Bara est premier avec 27000.',
          intent: 'top_clients',
          dataQuality: 'ok',
          period: {
            code: 'mois',
            label: 'Mois',
            from: '2026-10-01',
            to: '2026-10-14',
            definition: 'calendaire',
          },
          toolsUsed: ['loadMiOrgInsights'],
          insights: {
            topClients: [
              {
                clientId: 'b',
                displayName: 'Bara',
                phoneMasked: '***01',
                spent: 27_000,
                visits: 2,
                averageBasket: 13_500,
                favoriteProduct: 'Thieb',
              },
            ],
          },
          meta: {
            requestId: 'r1',
            model: 'mock',
            cached: false,
            latencyMs: 10,
            skippedAi: false,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await postMiChat(
      { message: 'Meilleurs clients', locale: 'fr', period: 'mois', history: [] },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toContain('Bara');
    expect(result.period.from).toBe('2026-10-01');
    expect(result.insights.topClients).toEqual([
      expect.objectContaining({ spent: 27_000, displayName: 'Bara' }),
    ]);
    const fetchCalls = fetchImpl.mock.calls as unknown as Array<[unknown, RequestInit?]>;
    const body = JSON.parse(String(fetchCalls[0]?.[1]?.body));
    expect(body.period).toBe('mois');
    expect(body.message).toBe('Meilleurs clients');
  });

  it('réseau / abort → erreurs contrôlées', async () => {
    const net = await postMiChat(
      { message: 'x', locale: 'en', history: [] },
      {
        fetchImpl: async () => {
          throw new TypeError('Failed to fetch');
        },
      }
    );
    expect(net.ok).toBe(false);
    if (!net.ok) expect(net.status).toBe(0);

    const abort = await postMiChat(
      { message: 'x', locale: 'fr', history: [] },
      {
        fetchImpl: async (_url, init) => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          // simulate already aborted
          if (init?.signal?.aborted) throw err;
          throw err;
        },
      }
    );
    expect(abort.ok).toBe(false);
    if (!abort.ok) expect(abort.status).toBe(504);
  });
});
