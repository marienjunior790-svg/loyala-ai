import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  completeWhatsAppEmbeddedSignupForOrganization,
  exchangeWhatsAppEmbeddedSignupCode,
  subscribeWhatsAppWabaWebhooks,
} from './whatsapp-embedded-signup';

const appSecret = 'meta-app-secret-value-xyz';
const oauthCode = `AQ${'B'.repeat(48)}`;
const accessToken = `EAA${'C'.repeat(40)}`;

describe('exchangeWhatsAppEmbeddedSignupCode', () => {
  it('échange le code côté serveur et ne fuit pas le secret en erreur', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: { message: `bad secret ${appSecret} code ${oauthCode}` } }),
        { status: 400 }
      )
    );
    const result = await exchangeWhatsAppEmbeddedSignupCode({
      code: oauthCode,
      appId: '111',
      appSecret,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain(appSecret);
      expect(result.message).not.toContain(oauthCode);
      expect(result.message).toMatch(/\[secret\]|\[redacted\]|refus/i);
    }
  });

  it('retourne le token uniquement au serveur (pas dans un message client)', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      expect(url).toContain('oauth/access_token');
      expect(url).toContain('client_secret=');
      return new Response(JSON.stringify({ access_token: accessToken, expires_in: 3600 }), {
        status: 200,
      });
    });
    const result = await exchangeWhatsAppEmbeddedSignupCode({
      code: oauthCode,
      appId: '111',
      appSecret,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accessToken).toBe(accessToken);
      expect(result.expiresIn).toBe(3600);
    }
  });
});

describe('subscribeWhatsAppWabaWebhooks', () => {
  it('redacte le token si Meta refuse', async () => {
    const result = await subscribeWhatsAppWabaWebhooks({
      wabaId: '987654321098765',
      accessToken,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: `denied ${accessToken}` } }), {
          status: 403,
        }),
    });
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain(accessToken);
  });
});

describe('completeWhatsAppEmbeddedSignupForOrganization', () => {
  it('refuse des IDs invalides avant tout appel Graph', async () => {
    const supabase = {} as SupabaseClient;
    await expect(
      completeWhatsAppEmbeddedSignupForOrganization(supabase, {
        organizationId: 'org-b',
        userId: 'user-1',
        accessToken,
        phoneNumberId: 'bad',
        wabaId: 'also-bad',
      })
    ).rejects.toThrow(/incomplets/i);
  });
});
