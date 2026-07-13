function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('242')) return digits;
  if (digits.startsWith('0')) return `242${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppDeepLink(phone: string, message: string): string {
  const digits = normalizePhoneDigits(phone);
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}
