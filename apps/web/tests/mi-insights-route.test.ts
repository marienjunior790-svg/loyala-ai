import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthContext = vi.fn();
const createClient = vi.fn(async () => ({ __tag: 'user-supabase' }));
const loadMiOrgInsights = vi.fn();
const withRateLimit = vi.fn(async (_req: Request, handler: () => Promise<Response>) => handler());

vi.mock('@/lib/auth/session', () => ({ getAuthContext: () => getAuthContext() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }));
vi.mock('@loyala/domain-crm', () => ({
  loadMiOrgInsights: (...args: unknown[]) => loadMiOrgInsights(...args),
  miInsightsForPrompt: (insights: { organizationId: string; dataQuality: string }) => ({
    organizationId: insights.organizationId,
    dataQuality: insights.dataQuality,
    kpis: null,
    opportunities: [],
    trends: null,
  }),
}));
vi.mock('@/lib/security/api-guard', () => ({
  withRateLimit: (req: Request, handler: () => Promise<Response>, key?: string) =>
    withRateLimit(req, handler, key),
}));

const { GET } = await import('../app/api/mi/insights/route');

describe('GET /api/mi/insights', () => {
  beforeEach(() => {
    getAuthContext.mockReset();
    createClient.mockClear();
    loadMiOrgInsights.mockReset();
    withRateLimit.mockClear();
  });

  it('401 sans session', async () => {
    getAuthContext.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/mi/insights'));
    expect(res.status).toBe(401);
    expect(loadMiOrgInsights).not.toHaveBeenCalled();
  });

  it('403 sans analytics:read', async () => {
    getAuthContext.mockResolvedValue({
      userId: 'u1',
      organizationId: 'org-a',
      role: 'org_staff',
    });
    const res = await GET(new Request('http://localhost/api/mi/insights?period=mois'));
    expect(res.status).toBe(403);
    expect(loadMiOrgInsights).not.toHaveBeenCalled();
  });

  it('charge l’org de session uniquement', async () => {
    getAuthContext.mockResolvedValue({
      userId: 'u1',
      organizationId: 'org-session',
      role: 'org_owner',
    });
    loadMiOrgInsights.mockResolvedValue({
      organizationId: 'org-session',
      dataQuality: 'ok',
      period: { code: 'mois', label: 'Mois', from: 'a', to: 'b', definition: 'd' },
      restaurantName: 'R',
      timezone: 'Africa/Dakar',
      currency: 'XOF',
      limits: [],
      kpis: null,
      topClients: [],
      topProducts: [],
      topCategories: [],
      segments: null,
      inactiveLoyal: [],
      clientCount: 0,
      trends: null,
      opportunities: [],
      customerIntelligence: {
        period: { code: 'mois', label: 'Mois', from: 'a', to: 'b', definition: 'd' },
        dataQuality: 'ok',
        metrics: [],
        segments: null,
        medianRecencyDays: null,
      },
      retentionStrategies: [],
      campaignProposals: [],
    });

    const res = await GET(new Request('http://localhost/api/mi/insights?period=semaine'));
    expect(res.status).toBe(200);
    expect(loadMiOrgInsights).toHaveBeenCalledWith(
      expect.anything(),
      'org-session',
      expect.objectContaining({ period: 'semaine' })
    );
    expect(withRateLimit.mock.calls[0]?.[2]).toBe('mi-insights');
    const body = await res.json();
    expect(body.dataQuality).toBe('ok');
    expect(body.toolsUsed).toContain('loadMiOrgInsights');
  });

  it('400 période invalide', async () => {
    getAuthContext.mockResolvedValue({
      userId: 'u1',
      organizationId: 'org-a',
      role: 'org_manager',
    });
    const res = await GET(new Request('http://localhost/api/mi/insights?period=invalid'));
    expect(res.status).toBe(400);
    expect(loadMiOrgInsights).not.toHaveBeenCalled();
  });
});
