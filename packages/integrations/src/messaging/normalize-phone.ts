/** E.164 digits only (no +) for Meta WhatsApp Cloud API. */
export function normalizePhoneForWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('242')) return digits;
  if (digits.startsWith('221')) return digits;
  if (digits.startsWith('225')) return digits;
  if (digits.startsWith('0')) return `242${digits.slice(1)}`;
  return digits;
}
