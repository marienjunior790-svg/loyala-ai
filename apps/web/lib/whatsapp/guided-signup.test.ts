import { describe, expect, it } from 'vitest';
import {
  describeGuidedWhatsAppSignup,
  whatsAppDialogClaim,
  whatsAppStatusCopy,
  whatsAppUiState,
} from './guided-signup';

const empty = {
  status: 'not_connected' as const,
  isReady: false,
  hasToken: false,
  phoneNumberId: null,
  displayPhone: null,
};

const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('describeGuidedWhatsAppSignup', () => {
  it('bloque le lancement sans configuration Meta publique', () => {
    const result = describeGuidedWhatsAppSignup({});
    expect(result.canLaunch).toBe(false);
    expect(result.readiness).toBe('not_configured');
    expect(result.publicConfig).toBeNull();
    expect(result.message).toMatch(/pas configurée|App ID|Configuration ID/i);
    expect(JSON.stringify(result)).not.toMatch(/EAA|secret/i);
  });

  it('refuse un prérequis public partiel', () => {
    const result = describeGuidedWhatsAppSignup({ NEXT_PUBLIC_META_APP_ID: '123' });
    expect(result.canLaunch).toBe(false);
    expect(result.readiness).toBe('not_configured');
    expect(result.publicConfig).toBeNull();
  });

  it('ne lance pas si seules les valeurs publiques sont présentes (serveur non prêt)', () => {
    const result = describeGuidedWhatsAppSignup({
      NEXT_PUBLIC_META_APP_ID: '123456789012345',
      NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: '987654321098765',
    });
    expect(result.canLaunch).toBe(false);
    expect(result.readiness).toBe('server_not_ready');
    expect(result.publicConfig).toBeNull();
    expect(result.message).toMatch(/serveur n’est pas prêt/i);
  });

  it('autorise le lancement seulement si public + secret + chiffrement', () => {
    const result = describeGuidedWhatsAppSignup({
      NEXT_PUBLIC_META_APP_ID: '123456789012345',
      NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: '987654321098765',
      WHATSAPP_APP_SECRET: 'not-a-real-secret',
      LOYALA_SECRETS_ENCRYPTION_KEY: encryptionKey,
    });
    expect(result.canLaunch).toBe(true);
    expect(result.readiness).toBe('ready_to_launch');
    expect(result.publicConfig).toEqual({
      appId: '123456789012345',
      configId: '987654321098765',
      apiVersion: 'v21.0',
    });
    expect(JSON.stringify(result)).not.toContain('not-a-real-secret');
    expect(JSON.stringify(result)).not.toContain(encryptionKey);
  });

  it('accepte META_APP_SECRET comme alias si WHATSAPP_APP_SECRET est vide', () => {
    const result = describeGuidedWhatsAppSignup({
      NEXT_PUBLIC_META_APP_ID: '123456789012345',
      NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: '987654321098765',
      META_APP_SECRET: 'alias-secret-value',
      LOYALA_SECRETS_ENCRYPTION_KEY: encryptionKey,
    });
    expect(result.canLaunch).toBe(true);
    expect(JSON.stringify(result)).not.toContain('alias-secret-value');
  });
});

describe('whatsAppStatusCopy', () => {
  it('distingue les états réels sans déclarer une connexion absente', () => {
    expect(whatsAppUiState(empty)).toBe('not_connected');
    expect(whatsAppStatusCopy(empty).title).toBe('WhatsApp non connecté');
    expect(whatsAppUiState({ ...empty, status: 'connecting' })).toBe('connecting');
    expect(whatsAppUiState({ ...empty, status: 'token_expired', hasToken: true })).toBe('expired');
    expect(whatsAppUiState({ ...empty, status: 'error' })).toBe('action_required');
    expect(whatsAppUiState({ ...empty, displayPhone: '+242065719922' })).toBe('number_pending');
    expect(
      whatsAppStatusCopy({
        ...empty,
        status: 'connected',
        isReady: true,
        hasToken: true,
        phoneNumberId: '123456789012345',
        displayPhone: '+221771234567',
      }).title
    ).toBe('Connexion opérationnelle');
  });
});

describe('whatsAppDialogClaim', () => {
  it('ne traite pas un numéro seul comme une connexion', () => {
    expect(whatsAppDialogClaim({ apiReady: false, savedPhone: '+221771234567' }).connected).toBe(false);
    expect(whatsAppDialogClaim({ apiReady: true, savedPhone: '' }).connected).toBe(true);
    expect(whatsAppDialogClaim({ apiReady: false, savedPhone: '' }).title).toMatch(/non connecté/);
  });
});
