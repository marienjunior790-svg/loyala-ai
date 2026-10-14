import { phoneDigitsForWhatsApp } from '@loyala/integrations/phone';

/**
 * Lien wa.me. Passez de préférence clients.phone_e164 ; à défaut le numéro saisi
 * et le pays du restaurant (sans pays, un numéro en 0… est supposé congolais).
 */
export function buildWhatsAppUrl(phone: string, message: string, country?: string | null): string {
  const digits = phoneDigitsForWhatsApp(phone, country);
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}

export function buildClientRelanceMessage(params: {
  clientName: string;
  restaurantName?: string;
}): string {
  const restaurant = params.restaurantName ?? 'notre restaurant';
  const firstName = params.clientName.split(' ')[0] ?? params.clientName;
  return `Bonjour ${firstName} 👋\n\nCela fait un moment que nous ne vous avons pas vu chez ${restaurant}.\n\nNous serions ravis de vous accueillir à nouveau cette semaine 🍽️\n\nÀ très bientôt !`;
}

/** WhatsApp message inviting the guest to leave a Google review. */
export function buildGoogleReviewRequestMessage(params: {
  clientName: string;
  restaurantName?: string;
  reviewUrl: string;
}): string {
  const restaurant = params.restaurantName ?? 'notre restaurant';
  const firstName = params.clientName.split(' ')[0] ?? params.clientName;
  return `Bonjour ${firstName} 👋\n\nMerci pour votre visite chez ${restaurant} !\n\nVotre avis Google nous aide beaucoup ⭐\nCela prend 30 secondes :\n${params.reviewUrl}\n\nÀ très bientôt !`;
}

export function buildDemoBookingMessage(): string {
  return 'Bonjour Loyala 👋 Je souhaite réserver une démo WhatsApp de 3 minutes pour mon restaurant.';
}
