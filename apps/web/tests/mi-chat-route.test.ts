import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthContext = vi.fn();
const createClient = vi.fn(async () => ({ __tag: 'user-supabase' }));
const runMiChatTurn = vi.fn();
const withRateLimit = vi.fn(
  async (_req: Request, handler: () => Promise<Response>, _key?: string) => handler()
);

vi.mock('@/lib/auth/session', () => ({ getAuthContext: () => getAuthContext() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }));
vi.mock('@/lib/mi/run-turn', () => ({ runMiChatTurn: (...args: unknown[]) => runMiChatTurn(...args) }));
vi.mock('@/lib/security/api-guard', () => ({
  withRateLimit: (req: Request, handler: () => Promise<Response>, key?: string) =>
    withRateLimit(req, handler, key),
}));

const { POST } = await import('../app/api/mi/chat/route');

describe('POST /api/mi/chat', () => {
  beforeEach(() => {
    getAuthContext.mockReset();
    createClient.mockClear();
    runMiChatTurn.mockReset();
    withRateLimit.mockClear();
  });

  it('401 sans session', async () => {
    getAuthContext.mockResolvedValue(null);
    const res = await POST(new Request('http://localhost/api/mi/chat', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
    expect(runMiChatTurn).not.toHaveBeenCalled();
  });

  it('403 sans analytics:read (org_staff)', async () => {
    getAuthContext.mockResolvedValue({
      userId: 'u1',
      organizationId: 'org-a',
      role: 'org_staff',
    });
    const res = await POST(
      new Request('http://localhost/api/mi/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Meilleurs clients' }),
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('forbidden');
    expect(body.permission).toBe('analytics:read');
    expect(runMiChatTurn).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('passe organizationId de session uniquement (pas du body)', async () => {
    getAuthContext.mockResolvedValue({
      userId: 'u1',
      organizationId: 'org-session',
      role: 'org_manager',
    });
    runMiChatTurn.mockResolvedValue({
      ok: true,
      answer: 'ok',
      intent: 'top_clients',
      dataQuality: 'ok',
      period: { code: 'mois', label: 'Mois', from: 'a', to: 'b', definition: 'd' },
      toolsUsed: ['loadMiOrgInsights'],
      insights: { topClients: [] },
      meta: { requestId: null, model: null, cached: false, latencyMs: 0, skippedAi: true },
    });

    const res = await POST(
      new Request('http://localhost/api/mi/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: 'Meilleurs clients',
          organizationId: 'org-attacker',
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(runMiChatTurn).toHaveBeenCalledOnce();
    const arg = runMiChatTurn.mock.calls[0]?.[0];
    expect(arg.organizationId).toBe('org-session');
    expect(arg.organizationId).not.toBe('org-attacker');
    expect(arg.supabase).toEqual({ __tag: 'user-supabase' });
  });

  it('400 sur validation', async () => {
    getAuthContext.mockResolvedValue({
      userId: 'u1',
      organizationId: 'org-a',
      role: 'org_viewer',
    });
    const res = await POST(
      new Request('http://localhost/api/mi/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      })
    );
    expect(res.status).toBe(400);
    expect(runMiChatTurn).not.toHaveBeenCalled();
  });

  it('mappe ai_quota → 429', async () => {
    getAuthContext.mockResolvedValue({
      userId: 'u1',
      organizationId: 'org-a',
      role: 'org_admin',
    });
    runMiChatTurn.mockResolvedValue({
      ok: false,
      code: 'ai_quota',
      message: 'Quota',
    });
    const res = await POST(
      new Request('http://localhost/api/mi/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Aperçu' }),
      })
    );
    expect(res.status).toBe(429);
  });
});
