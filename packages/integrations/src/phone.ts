/**
 * Numéros de téléphone : une seule règle pour le stockage (clients.phone_e164),
 * la recherche de doublons, les liens wa.me et l'envoi WhatsApp.
 * Doit rester identique à public.normalize_phone_e164 (migration 040).
 */

export const PHONE_DIAL_CODES: Readonly<Record<string, string>> = {
  SN: '221',
  CG: '242',
  CI: '225',
  CM: '237',
  ML: '223',
  BF: '226',
  BJ: '229',
  TG: '228',
  GN: '224',
  NE: '227',
  GA: '241',
  CD: '243',
  CF: '236',
  TD: '235',
  GQ: '240',
  AO: '244',
  ST: '239',
  MA: '212',
  NG: '234',
  FR: '33',
};

/**
 * Pays où le 0 initial est un préfixe national à retirer (+33 6…, +243 8…).
 * Au Congo et en Côte d'Ivoire il fait partie du numéro (+242 06…, +225 07…).
 */
const TRUNK_ZERO_COUNTRIES = new Set(['FR', 'CD', 'MA', 'NG']);

/** Pays supposé pour un numéro local quand le restaurant n'est pas connu. */
export const DEFAULT_PHONE_COUNTRY = 'CG';

const MIN_SUBSCRIBER_DIGITS = 8;

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '');
}

function startsWithPlus(raw: string): boolean {
  return raw.replace(/^[ \t\r\n]+/, '').startsWith('+');
}

/**
 * Format international « +242061234567 » à partir d'une saisie libre et du pays
 * du restaurant. Renvoie null si le numéro est vide ou le pays non pris en charge.
 */
export function normalizePhoneE164(
  raw: string | null | undefined,
  country: string | null | undefined
): string | null {
  const text = raw ?? '';
  const digits = digitsOf(text);
  if (!digits) return null;
  if (startsWithPlus(text)) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;

  const iso = (country ?? '').toUpperCase();
  const code = PHONE_DIAL_CODES[iso];
  if (!code) return null;
  if (digits.startsWith(code) && digits.length >= code.length + MIN_SUBSCRIBER_DIGITS) {
    return `+${digits}`;
  }
  if (TRUNK_ZERO_COUNTRIES.has(iso) && digits.startsWith('0')) {
    return `+${code}${digits.slice(1)}`;
  }
  return `+${code}${digits}`;
}

/**
 * Numéro sans pays connu (adresse WhatsApp reçue de Meta, ancien enregistrement) :
 * un indicatif connu en tête est conservé, un numéro commençant par 0 est
 * considéré comme local au pays par défaut. Sinon : null (pas de supposition).
 */
export function normalizeInternationalPhone(raw: string | null | undefined): string | null {
  const text = raw ?? '';
  const digits = digitsOf(text);
  if (!digits) return null;
  if (startsWithPlus(text)) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  for (const code of Object.values(PHONE_DIAL_CODES)) {
    if (digits.startsWith(code) && digits.length >= code.length + MIN_SUBSCRIBER_DIGITS) {
      return `+${digits}`;
    }
  }
  if (digits.startsWith('0')) return normalizePhoneE164(digits, DEFAULT_PHONE_COUNTRY);
  return null;
}

/**
 * Chiffres attendus par l'API WhatsApp et wa.me (sans « + »). Avec le pays du
 * restaurant, même règle que le stockage ; sans pays, règle internationale.
 * Un numéro indéterminable est renvoyé tel quel (chiffres) : WhatsApp le
 * refusera plutôt que d'écrire à un inconnu.
 */
export function phoneDigitsForWhatsApp(raw: string | null | undefined, country?: string | null): string {
  const e164 = (country ? normalizePhoneE164(raw, country) : null) ?? normalizeInternationalPhone(raw);
  return e164 ? e164.slice(1) : digitsOf(raw ?? '');
}
