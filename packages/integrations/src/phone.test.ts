import { describe, expect, it } from 'vitest';
import { normalizeInternationalPhone, normalizePhoneE164, phoneDigitsForWhatsApp } from './phone';

describe('normalizePhoneE164 — Congo (Brazzaville)', () => {
  it.each([
    ['061234567', '+242061234567'],
    ['06 123 45 67', '+242061234567'],
    ['06-123-45-67', '+242061234567'],
    ['051234567', '+242051234567'],
    ['05 123 45 67', '+242051234567'],
    ['+242 06 123 45 67', '+242061234567'],
    ['+242061234567', '+242061234567'],
    ['+242 05 123 45 67', '+242051234567'],
    ['242 06 123 45 67', '+242061234567'],
    ['00242 05 123 45 67', '+242051234567'],
    ['  +242 06 123 45 67', '+242061234567'],
  ])('%s → %s (le 0 fait partie du numéro)', (raw, expected) => {
    expect(normalizePhoneE164(raw, 'CG')).toBe(expected);
  });

  it('ne confond pas un 06 et un 05', () => {
    expect(normalizePhoneE164('06 123 45 67', 'CG')).not.toBe(normalizePhoneE164('05 123 45 67', 'CG'));
  });

  it('local et international donnent la même clé de doublon', () => {
    const keys = ['06 123 45 67', '+242 06 123 45 67', '242061234567', '00242061234567'].map((p) =>
      normalizePhoneE164(p, 'CG')
    );
    expect(new Set(keys).size).toBe(1);
  });
});

describe('normalizePhoneE164 — autres pays', () => {
  it.each([
    ['77 123 45 67', 'SN', '+221771234567'],
    ['+221 77 123 45 67', 'SN', '+221771234567'],
    ['07 01 02 03 04', 'CI', '+2250701020304'],
    ['06 12 34 56 78', 'FR', '+33612345678'],
    ['0812345678', 'CD', '+243812345678'],
    ['0612345678', 'MA', '+212612345678'],
    ['6 77 12 34 56', 'CM', '+237677123456'],
  ])('%s (%s) → %s', (raw, country, expected) => {
    expect(normalizePhoneE164(raw, country)).toBe(expected);
  });

  it('un numéro d’un autre pays saisi avec + reste inchangé', () => {
    expect(normalizePhoneE164('+221 77 123 45 67', 'CG')).toBe('+221771234567');
  });

  it('ne devine rien sans pays pris en charge ni indicatif', () => {
    expect(normalizePhoneE164('77 123 45 67', 'US')).toBeNull();
    expect(normalizePhoneE164('77 123 45 67', null)).toBeNull();
    expect(normalizePhoneE164('', 'CG')).toBeNull();
    expect(normalizePhoneE164('   ', 'CG')).toBeNull();
  });
});

describe('normalizeInternationalPhone — adresse sans pays (Meta, anciens enregistrements)', () => {
  it.each([
    ['242061234567', '+242061234567'],
    ['242051234567', '+242051234567'],
    ['221771234567', '+221771234567'],
    ['+242 05 123 45 67', '+242051234567'],
    ['061234567', '+242061234567'],
    ['051234567', '+242051234567'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeInternationalPhone(raw)).toBe(expected);
  });

  it('ne suppose pas de pays pour un numéro sans indicatif ni 0', () => {
    expect(normalizeInternationalPhone('771234567')).toBeNull();
  });
});

describe('phoneDigitsForWhatsApp — format envoyé à Meta et wa.me', () => {
  it.each([
    ['06 123 45 67', '242061234567'],
    ['05 123 45 67', '242051234567'],
    ['+242 06 123 45 67', '242061234567'],
    ['+242 05 123 45 67', '242051234567'],
  ])('%s → %s', (raw, expected) => {
    expect(phoneDigitsForWhatsApp(raw)).toBe(expected);
    expect(phoneDigitsForWhatsApp(raw, 'CG')).toBe(expected);
  });

  it('utilise le pays du restaurant pour un numéro local', () => {
    expect(phoneDigitsForWhatsApp('77 123 45 67', 'SN')).toBe('221771234567');
  });

  it('accepte la valeur phone_e164 déjà calculée par la base', () => {
    expect(phoneDigitsForWhatsApp('+242061234567', 'SN')).toBe('242061234567');
  });

  it('renvoie les chiffres bruts plutôt que d’inventer un indicatif', () => {
    expect(phoneDigitsForWhatsApp('771234567')).toBe('771234567');
  });
});
