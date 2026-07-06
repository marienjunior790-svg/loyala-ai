/** Normalise un numéro local (ex. 065719922) vers indicatif +242 pour wa.me */
function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('242')) return digits;
  if (digits.startsWith('0')) return `242${digits.slice(1)}`;
  return digits;
}

/** Build a wa.me deep link (digits only for phone). */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = normalizePhoneDigits(phone);
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

export function buildDemoBookingMessage(): string {
  return 'Bonjour Loyala 👋 Je souhaite réserver une démo WhatsApp de 3 minutes pour mon restaurant.';
}
