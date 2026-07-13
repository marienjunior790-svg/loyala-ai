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
    expect(result.phone).toBe('24265719922');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain('hello_world');
    expect(String(init.body)).toContain('24265719922');
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
