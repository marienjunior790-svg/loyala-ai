import { phoneDigitsForWhatsApp } from '../phone';

/** Chiffres E.164 sans « + » pour l'API WhatsApp Cloud de Meta. */
export function normalizePhoneForWhatsApp(raw: string, country?: string | null): string {
  return phoneDigitsForWhatsApp(raw, country);
}
