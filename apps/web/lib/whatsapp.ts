/** Build a wa.me deep link (digits only for phone). */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}

export function buildDemoBookingMessage(): string {
  return 'Bonjour Loyala 👋 Je souhaite réserver une démo WhatsApp de 3 minutes pour mon restaurant.';
}

export function buildClientRelanceMessage(params: {
  clientName: string;
  restaurantName?: string;
}): string {
  const restaurant = params.restaurantName ?? 'notre restaurant';
  const firstName = params.clientName.split(' ')[0] ?? params.clientName;
  return `Bonjour ${firstName} 👋\n\nCela fait un moment que nous ne vous avons pas vu chez ${restaurant}.\n\nNous serions ravis de vous accueillir à nouveau cette semaine 🍽️\n\nÀ très bientôt !`;
}
