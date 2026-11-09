import { afterEach, describe, expect, it } from 'vitest';
import {
  createWhatsAppEmbeddedSignupState,
  readWhatsAppEmbeddedSignupState,
} from './embedded-signup-state';

const previous = process.env.LOYALA_SECRETS_ENCRYPTION_KEY;

afterEach(() => {
  if (previous === undefined) delete process.env.LOYALA_SECRETS_ENCRYPTION_KEY;
  else process.env.LOYALA_SECRETS_ENCRYPTION_KEY = previous;
});

describe('embedded-signup-state', () => {
  it('accepte un state valide avec le nonce cookie', () => {
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const { nonce, state } = createWhatsAppEmbeddedSignupState({
      organizationId: 'org-a',
      userId: 'user-1',
    });
    const parsed = readWhatsAppEmbeddedSignupState(state, nonce);
    expect(parsed.organizationId).toBe('org-a');
    expect(parsed.userId).toBe('user-1');
    expect(parsed.nonce).toBe(nonce);
  });

  it('refuse un nonce incorrect (CSRF)', () => {
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const { state } = createWhatsAppEmbeddedSignupState({
      organizationId: 'org-a',
      userId: 'user-1',
    });
    expect(() => readWhatsAppEmbeddedSignupState(state, 'wrong-nonce')).toThrow(/invalide/i);
  });

  it('refuse un state expiré', () => {
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const { nonce, state } = createWhatsAppEmbeddedSignupState({
      organizationId: 'org-a',
      userId: 'user-1',
    });
    expect(() =>
      readWhatsAppEmbeddedSignupState(state, nonce, Date.now() + 20 * 60 * 1000)
    ).toThrow(/invalide/i);
  });

  it('refuse une signature altérée', () => {
    process.env.LOYALA_SECRETS_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const { nonce, state } = createWhatsAppEmbeddedSignupState({
      organizationId: 'org-a',
      userId: 'user-1',
    });
    const [payload] = state.split('.');
    expect(() => readWhatsAppEmbeddedSignupState(`${payload}.tampered`, nonce)).toThrow(/invalide/i);
  });
});
