import { phoneDigitsForWhatsApp } from '@loyala/integrations/phone';

export function buildWhatsAppDeepLink(phone: string, message: string, country?: string | null): string {
  const digits = phoneDigitsForWhatsApp(phone, country);
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}
