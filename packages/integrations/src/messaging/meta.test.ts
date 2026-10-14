import { describe, expect, it, vi, afterEach } from 'vitest';
import { sendViaMeta } from './providers/meta';

const config = {
  accessToken: 'test-token',
  phoneNumberId: '123456789',
  apiVersion: 'v21.0',
};

describe('sendViaMeta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a template message and returns wamid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.TEST123' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendViaMeta(
      {
        type: 'template',
        phone: '065719922',
        templateName: 'hello_world',
        templateLanguage: 'fr',
        templateVariables: ['Marc'],
      },
      config
    );

    expect(result.wamid).toBe('wamid.TEST123');
    expect(result.status).toBe('sent');
    expect(result.phone).toBe('242065719922');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain('hello_world');
    expect(JSON.parse(String(init.body)).to).toBe('242065719922');
  });

  it.each([
    ['06 123 45 67', '242061234567'],
    ['05 123 45 67', '242051234567'],
    ['+242 06 123 45 67', '242061234567'],
    ['+242 05 123 45 67', '242051234567'],
  ])('envoie %s au destinataire congolais %s (aucun appel réel, fetch simulé)', async (phone, expected) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.CG' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendViaMeta({ type: 'text', phone, body: 'Test' }, config);
    expect(result.phone).toBe(expected);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).to).toBe(expected);
  });

  it('throws MetaWhatsAppError on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: { message: 'Invalid template' } }),
      })
    );

    await expect(
      sendViaMeta(
        { type: 'template', phone: '+221771234567', templateName: 'bad_template' },
        config
      )
    ).rejects.toThrow(/Invalid template/);
  });
});
