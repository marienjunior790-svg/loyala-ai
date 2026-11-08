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

describe('describeGuidedWhatsAppSignup', () => {
  it('reste impossible à lancer sans configuration Meta', () => {
    const result = describeGuidedWhatsAppSignup({});
    expect(result.canLaunch).toBe(false);
    expect(result.message).toMatch(/pas encore disponible/);
    expect(JSON.stringify(result)).not.toMatch(/EAA|secret/i);
  });

  it('ne lance pas le parcours même si les prérequis sont présents', () => {
    const result = describeGuidedWhatsAppSignup({
      NEXT_PUBLIC_META_APP_ID: '123',
      NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: 'cfg',
      WHATSAPP_APP_SECRET: 'not-a-real-secret',
    });
    expect(result.canLaunch).toBe(false);
    expect(result.message).toMatch(/n’est pas encore activé/);
    expect(JSON.stringify(result)).not.toContain('not-a-real-secret');
  });

  it('refuse un prérequis partiel', () => {
    expect(
      describeGuidedWhatsAppSignup({ NEXT_PUBLIC_META_APP_ID: '123' }).message
    ).toMatch(/pas encore disponible/);
  });
});

describe('whatsAppStatusCopy', () => {
  it('distingue les états réels sans déclarer une connexion absente', () => {
    expect(whatsAppUiState(empty)).toBe('not_connected');
    expect(whatsAppStatusCopy(empty).title).toBe('WhatsApp non connecté');
    expect(
      whatsAppUiState({ ...empty, status: 'connecting' })
    ).toBe('connecting');
    expect(
      whatsAppUiState({ ...empty, status: 'token_expired', hasToken: true })
    ).toBe('expired');
    expect(whatsAppUiState({ ...empty, status: 'error' })).toBe('action_required');
    expect(
      whatsAppUiState({ ...empty, displayPhone: '+242065719922' })
    ).toBe('number_pending');
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
