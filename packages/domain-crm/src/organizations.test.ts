import { describe, expect, it, vi } from 'vitest';
import { getOrganization } from './organizations';

function mockClient(responses: Array<{ data: unknown; error: { message: string } | null }>) {
  let i = 0;
  const maybeSingle = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return r;
  });
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle,
  };
  return {
    from: () => chain,
    _maybeSingle: maybeSingle,
  };
}

describe('getOrganization schema fallback', () => {
  it('falls back when plan_status / deleted_at missing then succeeds', async () => {
    const client = mockClient([
      { data: null, error: { message: 'column organizations.deleted_at does not exist' } },
      { data: null, error: { message: 'column organizations.plan_status does not exist' } },
      {
        data: { id: 'o1', name: 'Chez Alice', slug: 'chez-alice', settings: {} },
        error: null,
      },
    ]);

    const org = await getOrganization(client as never, 'o1');
    expect(org?.name).toBe('Chez Alice');
    expect(org?.plan_status).toBe('trialing');
    expect(client._maybeSingle).toHaveBeenCalledTimes(3);
  });
});
