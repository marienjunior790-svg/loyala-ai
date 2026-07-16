import { z } from 'zod';

export const congoPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((digits) => {
    if (digits.startsWith('242') && digits.length === 12) return true;
    if (digits.startsWith('0') && digits.length === 10) return true;
    if (digits.length === 9) return true;
    return false;
  }, 'Numéro Congo invalide (+242…)')
  .transform((digits) => {
    if (digits.startsWith('242')) return digits;
    if (digits.startsWith('0')) return `242${digits.slice(1)}`;
    return `242${digits}`;
  });

export const checkoutSchema = z.object({
  planCode: z.enum(['growth', 'pro']),
  phone: congoPhoneSchema,
  providerNetwork: z.enum(['MTN', 'AIRTEL']),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
