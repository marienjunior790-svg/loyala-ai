import { afterEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptSecret } from '@loyala/integrations/crypto/secrets';
import {
  getWhatsAppConnectionPublic,
  WHATSAPP_CONNECTION_PUBLIC_COLUMNS,
} from './whatsapp-connections';
import {
  getMetaWhatsAppConfigForOrganization,
  testWhatsAppConnectionForOrganization,
  upsertWhatsAppConnectionForOrganization,
  verifyMetaWhatsAppCredentials,
} from './whatsapp-connections-secure';

const token = `EAA${'A'.repeat(40)}`;

describe('lecture publique de la connexion', () => {
  it('ne sélectionne pas la colonne du jeton chiffré', () => {
    expect(WHATSAPP_CONNECTION_PUBLIC_COLUMNS).not.toMatch(/access_token/);
  });
});

function credentials(fetchImpl: typeof fetch) {
  return {
    accessToken: token,
    phoneNumberId: '123456789012345',
    wabaId: '987654321098765',
    displayPhone: '+221771234567',
    fetchImpl,
  };
}

describe('verifyMetaWhatsAppCredentials', () => {
  it('accepte un numéro et un compte confirmés par Meta, uniquement en GET', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('123456789012345')) {
        return new Response(
          JSON.stringify({ display_phone_number: '+221 77 123 45 67', verified_name: 'Bomaye' }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ id: '987654321098765', name: 'Bomaye WA' }), { status: 200 });
    };

    const result = await verifyMetaWhatsAppCredentials(credentials(fetchImpl));
    expect(result.ok).toBe(true);
    expect(calls.every((call) => call.startsWith('GET '))).toBe(true);
    expect(calls.join(' ')).not.toMatch(/messages/);
  });

  it('refuse un jeton invalide et ne renvoie pas le secret', async () => {
    const result = await verifyMetaWhatsAppCredentials(
      credentials(async () =>
        new Response(JSON.stringify({ error: { message: `Invalid token ${token}` } }), { status: 401 })
      )
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Invalid token/);
      expect(result.message).not.toContain(token);
      expect(result.message).toContain('[token]');
    }
  });

  it('refuse un numéro qui ne correspond pas au Phone number ID', async () => {
    const result = await verifyMetaWhatsAppCredentials(
      credentials(async () =>
        new Response(JSON.stringify({ display_phone_number: '+1 202 555 0100' }), { status: 200 })
      )
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/ne correspond pas/);
  });
});

describe('upsertWhatsAppConnectionForOrganization', () => {
  it('n’écrit rien avant la validation Meta : jeton, Phone number ID, WABA, délai ou réseau', async () => {
    const failures: Array<{ fetchImpl: typeof fetch; message: RegExp }> = [
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: { message: `Invalid token ${token}` } }), { status: 401 }),
        message: /\[token\]/,
      },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: { message: 'Object does not exist' } }), { status: 400 }),
        message: /Object does not exist/,
      },
      {
        fetchImpl: async (input) => {
          const url = String(input);
          if (url.includes('123456789012345')) {
            return new Response(
              JSON.stringify({ display_phone_number: '+221 77 123 45 67', verified_name: 'Bomaye' }),
              { status: 200 }
            );
          }
          return new Response(JSON.stringify({ error: { message: `WABA refused ${token}` } }), { status: 400 });
        },
        message: /\[token\]/,
      },
      {
        fetchImpl: async () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          throw error;
        },
        message: /joindre Meta/,
      },
      {
        fetchImpl: async () => {
          throw new TypeError('network down');
        },
        message: /joindre Meta/,
      },
    ];

    for (const failure of failures) {
      const calls: string[] = [];
      const writes: Array<Record<string, unknown>> = [];
      const supabase = {
        from() {
          const builder = {
            select() {
              return builder;
            },
            eq() {
              return builder;
            },
            upsert(payload: Record<string, unknown>) {
              writes.push(payload);
              return builder;
            },
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return builder;
        },
      } as unknown as SupabaseClient;
      const error = await upsertWhatsAppConnectionForOrganization(supabase, {
        organizationId: 'org-a',
        userId: 'user-1',
        ...credentials(async (input, init) => {
          const url = String(input);
          calls.push(`${init?.method ?? 'GET'} ${url}`);
          return failure.fetchImpl(input, init);
        }),
      }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(failure.message);
      expect((error as Error).message).not.toContain(token);
      expect(calls.join(' ')).not.toMatch(/messages/);
      expect(calls.join(' ')).not.toContain(token);
      expect(writes.length).toBeGreaterThan(0);
      expect(writes.every((row) => row.status === 'error')).toBe(true);
      expect(writes.some((row) => row.status === 'connected')).toBe(false);
      expect(JSON.stringify(writes)).not.toContain('access_token');
      expect(JSON.stringify(writes)).not.toContain(token);
    }
  });

  it('ne marque pas connected si Meta refuse, et conserve une erreur sans secret', async () => {
    const writes: Array<Record<string, unknown>> = [];
    const supabase = {
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          upsert(payload: Record<string, unknown>) {
            writes.push(payload);
            return builder;
          },
          maybeSingle: async () => ({ data: { status: 'error' }, error: null }),
        };
        return builder;
      },
    } as unknown as SupabaseClient;

    await expect(
      upsertWhatsAppConnectionForOrganization(supabase, {
        organizationId: 'org-a',
        userId: 'user-1',
        ...credentials(async () =>
          new Response(JSON.stringify({ error: { message: 'Numéro non autorisé' } }), { status: 403 })
        ),
      })
    ).rejects.toThrow(/Numéro non autorisé/);
    expect(writes).toEqual([
      expect.objectContaining({ organization_id: 'org-a', status: 'error', last_error: 'Numéro non autorisé' }),
    ]);
    expect(JSON.stringify(writes)).not.toContain(token);
  });

  it('ne dégrade pas une connexion déjà vérifiée si une nouvelle tentative échoue', async () => {
    const writes: unknown[] = [];
    const supabase = {
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          upsert(payload: unknown) {
            writes.push(payload);
            return builder;
          },
          maybeSingle: async () => ({ data: { status: 'connected' }, error: null }),
        };
        return builder;
      },
    } as unknown as SupabaseClient;

    await expect(
      upsertWhatsAppConnectionForOrganization(supabase, {
        organizationId: 'org-a',
        userId: 'user-1',
        ...credentials(async () =>
          new Response(JSON.stringify({ error: { message: 'Jeton refusé' } }), { status: 401 })
        ),
      })
    ).rejects.toThrow(/Jeton refusé/);
    expect(writes).toHaveLength(0);
  });

  it('enregistre le statut connecté seulement après les deux lectures Meta, sans jeton dans la réponse', async () => {
    const previous = process.env.LOYALA_SECRETS_ENCRYPTION_KEY;
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY = 'ab'.repeat(32);
    try {
      const order: string[] = [];
      let fetches = 0;
      let saved = false;
      let phonesReady = false;
      let cipher = '';
      const fetchImpl: typeof fetch = async (input, init) => {
        const url = String(input);
        order.push(`${init?.method ?? 'GET'} ${url}`);
        fetches += 1;
        if (url.includes('/messages')) throw new Error('envoi interdit');
        if (url.includes('123456789012345')) {
          return new Response(
            JSON.stringify({ display_phone_number: '+221 77 123 45 67', verified_name: 'Bomaye' }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ id: '987654321098765', name: 'Bomaye WA' }), { status: 200 });
      };
      const supabase = {
        from(table: string) {
          const builder = {
            select() {
              return builder;
            },
            eq() {
              return builder;
            },
            upsert(payload: Record<string, unknown>) {
              if (fetches < 2) order.push('write-too-early');
              if (table === 'whatsapp_connections') {
                saved = true;
                cipher = String(payload.access_token_encrypted ?? '');
                order.push(`status:${String(payload.status)}`);
              }
              return builder;
            },
            insert() {
              if (fetches < 2) order.push('write-too-early');
              if (table === 'whatsapp_phone_numbers') phonesReady = true;
              return builder;
            },
            update() {
              return builder;
            },
            delete() {
              return builder;
            },
            maybeSingle: async () => {
              if (table === 'whatsapp_connections' && saved) {
                return {
                  data: {
                    id: 'conn-1',
                    status: 'connected',
                    access_token_encrypted: cipher,
                    last_error: null,
                    last_synced_at: null,
                    connected_at: '2026-10-22T00:00:00.000Z',
                  },
                  error: null,
                };
              }
              if (table === 'whatsapp_phone_numbers' && phonesReady) {
                return {
                  data: {
                    phone_number_id: '123456789012345',
                    display_phone_number: '+221 77 123 45 67',
                    verified_name: 'Bomaye',
                  },
                  error: null,
                };
              }
              if (table === 'whatsapp_business_accounts' && saved) {
                return { data: { waba_id: '987654321098765', name: 'Bomaye WA' }, error: null };
              }
              return { data: null, error: null };
            },
            single: async () => {
              if (table === 'whatsapp_connections') {
                return { data: { id: 'conn-1' }, error: null };
              }
              if (table === 'organizations') return { data: { settings: {} }, error: null };
              return { data: null, error: null };
            },
          };
          return builder;
        },
      } as unknown as SupabaseClient;

      const result = await upsertWhatsAppConnectionForOrganization(supabase, {
        organizationId: 'org-a',
        userId: 'user-1',
        ...credentials(fetchImpl),
      });

      expect(order.filter((item) => item.startsWith('GET '))).toHaveLength(2);
      expect(order.join(' ')).not.toMatch(/messages/);
      expect(order).not.toContain('write-too-early');
      const connectedAt = order.indexOf('status:connected');
      expect(connectedAt).toBeGreaterThan(1);
      expect(result.status).toBe('connected');
      expect(result.isReady).toBe(true);
      expect(result).not.toHaveProperty('accessToken');
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(token);
      expect(cipher.startsWith('v1:')).toBe(true);
      expect(serialized).not.toContain(cipher);
      expect(cipher).not.toContain(token);
    } finally {
      if (previous === undefined) delete process.env.LOYALA_SECRETS_ENCRYPTION_KEY;
      else process.env.LOYALA_SECRETS_ENCRYPTION_KEY = previous;
    }
  });

  it('refuse le numéro déjà lié à une autre organisation', async () => {
    const previous = process.env.LOYALA_SECRETS_ENCRYPTION_KEY;
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY = 'ab'.repeat(32);
    const writes: Array<Record<string, unknown>> = [];
    const supabase = {
      from(table: string) {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          upsert(payload: Record<string, unknown>) {
            writes.push(payload);
            return builder;
          },
          maybeSingle: async () =>
            table === 'whatsapp_phone_numbers'
              ? { data: { organization_id: 'org-b' }, error: null }
              : { data: null, error: null },
        };
        return builder;
      },
    } as unknown as SupabaseClient;

    await expect(
      upsertWhatsAppConnectionForOrganization(supabase, {
        organizationId: 'org-a',
        userId: 'user-1',
        ...credentials(async (input) => {
          const url = String(input);
          if (url.includes('123456789012345')) {
            return new Response(JSON.stringify({ display_phone_number: '+221 77 123 45 67' }), { status: 200 });
          }
          return new Response(JSON.stringify({ id: '987654321098765', name: 'Bomaye WA' }), { status: 200 });
        }),
      })
    ).rejects.toThrow(/autre organisation/);
    expect(writes.some((row) => row.status === 'connected')).toBe(false);
    if (previous === undefined) delete process.env.LOYALA_SECRETS_ENCRYPTION_KEY;
    else process.env.LOYALA_SECRETS_ENCRYPTION_KEY = previous;
  });
});

describe('isolation de la connexion par organisation', () => {
  const previousKey = process.env.LOYALA_SECRETS_ENCRYPTION_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.LOYALA_SECRETS_ENCRYPTION_KEY;
    else process.env.LOYALA_SECRETS_ENCRYPTION_KEY = previousKey;
  });

  function store() {
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY = 'ab'.repeat(32);
    const rows = {
      'org-a': {
        status: 'connected',
        token: encryptSecret('token-org-a'),
        phone: '111111111111111',
        waba: '222222222222222',
      },
      'org-b': {
        status: 'connected',
        token: encryptSecret('token-org-b'),
        phone: '333333333333333',
        waba: '444444444444444',
      },
      'org-invalid': {
        status: 'error',
        token: encryptSecret('token-invalid'),
        phone: 'pending:555',
        waba: '666666666666666',
      },
    } as const;
    const supabase = {
      from(table: string) {
        const filters: Record<string, unknown> = {};
        const builder = {
          select(columns?: string) {
            if (
              table === 'whatsapp_connections' &&
              (columns === '*' || (typeof columns === 'string' && columns.includes('access_token_encrypted')))
            ) {
              filters.selectedToken = true;
            }
            return builder;
          },
          eq(column: string, value: unknown) {
            filters[column] = value;
            return builder;
          },
          update(payload: Record<string, unknown>) {
            filters.updated = payload;
            return builder;
          },
          maybeSingle: async () => {
            const org = String(filters.organization_id ?? '');
            const row = rows[org as keyof typeof rows];
            if (!row) return { data: null, error: null };
            if (table === 'whatsapp_connections') {
              if (filters.status && row.status !== filters.status) return { data: null, error: null };
              return {
                data: {
                  id: `conn-${org}`,
                  organization_id: org,
                  status: row.status,
                  access_token_encrypted: filters.selectedToken ? row.token : undefined,
                  last_error: null,
                  last_synced_at: null,
                  connected_at: '2026-10-22T00:00:00.000Z',
                },
                error: null,
              };
            }
            if (table === 'whatsapp_phone_numbers') {
              if (filters.connection_id && filters.connection_id !== `conn-${org}`) return { data: null, error: null };
              return {
                data: {
                  phone_number_id: row.phone,
                  display_phone_number: org === 'org-a' ? '+221770000001' : '+221770000002',
                  verified_name: org,
                },
                error: null,
              };
            }
            if (table === 'whatsapp_business_accounts') {
              return { data: { waba_id: row.waba, name: org }, error: null };
            }
            return { data: null, error: null };
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;
    return { supabase };
  }

  it('ne renvoie jamais le jeton ou le numéro d’une autre organisation', async () => {
    const { supabase } = store();
    const configA = await getMetaWhatsAppConfigForOrganization(supabase, 'org-a');
    const configB = await getMetaWhatsAppConfigForOrganization(supabase, 'org-b');
    const missing = await getMetaWhatsAppConfigForOrganization(supabase, 'org-missing');
    expect(configA).toMatchObject({ accessToken: 'token-org-a', phoneNumberId: '111111111111111' });
    expect(configB).toMatchObject({ accessToken: 'token-org-b', phoneNumberId: '333333333333333' });
    expect(configA?.accessToken).not.toBe(configB?.accessToken);
    expect(configA?.phoneNumberId).not.toBe(configB?.phoneNumberId);
    expect(missing).toBeNull();
  });

  it('refuse une connexion absente, invalide ou non vérifiée', async () => {
    const { supabase } = store();
    expect(await getMetaWhatsAppConfigForOrganization(supabase, 'org-invalid')).toBeNull();
    expect(await getMetaWhatsAppConfigForOrganization(supabase, 'org-absent')).toBeNull();
  });

  it('n’expose pas access_token_encrypted dans la lecture publique', async () => {
    const { supabase } = store();
    const pub = await getWhatsAppConnectionPublic(supabase, 'org-a');
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('token-org-a');
    expect(serialized).not.toContain('333333333333333');
    expect(pub.phoneNumberId).toBe('111111111111111');
    expect(pub).not.toHaveProperty('access_token_encrypted');
  });

  it('masque le jeton dans l’erreur Meta d’un test de connexion', async () => {
    const { supabase } = store();
    const secret = 'token-org-a';
    const result = await testWhatsAppConnectionForOrganization(supabase, 'org-a', async () =>
      new Response(JSON.stringify({ error: { message: `Invalid ${secret}` } }), { status: 401 })
    );
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain(secret);
    expect(result.message).toContain('[token]');
  });
});
