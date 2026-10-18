import { z } from 'zod';
import { visitItemSchema } from './catalog';

const optionalAmount = z
  .union([z.coerce.number().min(0, 'Montant invalide'), z.literal(''), z.undefined()])
  .transform((v) => (v === '' || v === undefined ? undefined : v));

export const orderTypeSchema = z.enum(['sur_place', 'a_emporter', 'livraison'], {
  errorMap: () => ({ message: 'Type de commande invalide' }),
});

export const paymentMethodSchema = z.enum(['cash', 'wave', 'orange_money', 'free_money', 'card', 'other'], {
  errorMap: () => ({ message: 'Choisissez le moyen de paiement' }),
});

const reasonSchema = z.string().trim().min(3, 'Indiquez un motif').max(300);

export const recordVisitSchema = z
  .object({
    clientId: z.string().uuid('Client invalide'),
    visitedAt: z.string().min(1, 'Date requise'),
    orderType: orderTypeSchema.default('sur_place'),
    paymentMethod: paymentMethodSchema,
    amount: optionalAmount,
    discount: optionalAmount,
    notes: z.string().max(500).optional().or(z.literal('')),
    items: z.array(visitItemSchema).optional(),
  })
  .refine((v) => (v.items?.length ?? 0) > 0 || v.amount !== undefined, {
    message: 'Ajoutez des articles ou un montant',
    path: ['amount'],
  });

export const updateVisitSchema = z.object({
  visitId: z.string().uuid('Commande invalide'),
  clientId: z.string().uuid('Client invalide'),
  visitedAt: z.string().min(1, 'Date requise'),
  orderType: orderTypeSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  amount: optionalAmount,
  discount: optionalAmount,
  notes: z.string().max(500).optional().or(z.literal('')),
});

export const cancelOrderSchema = z.object({
  visitId: z.string().uuid('Commande invalide'),
  clientId: z.string().uuid('Client invalide'),
  reason: reasonSchema,
});

export const refundOrderSchema = z.object({
  visitId: z.string().uuid('Commande invalide'),
  clientId: z.string().uuid('Client invalide'),
  amount: z.coerce.number().positive('Montant requis'),
  reason: reasonSchema,
});

export type RecordVisitInput = z.infer<typeof recordVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;
