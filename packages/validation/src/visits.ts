import { z } from 'zod';
import { visitItemSchema } from './catalog';

const optionalAmount = z
  .union([z.coerce.number().min(0, 'Montant invalide'), z.literal(''), z.undefined()])
  .transform((v) => (v === '' || v === undefined ? undefined : v));

export const recordVisitSchema = z.object({
  clientId: z.string().uuid('Client invalide'),
  visitedAt: z.string().min(1, 'Date requise'),
  amount: optionalAmount,
  notes: z.string().max(500).optional().or(z.literal('')),
  items: z.array(visitItemSchema).optional(),
});

export const recordExpenseSchema = z.object({
  clientId: z.string().uuid('Client invalide'),
  visitedAt: z.string().min(1, 'Date requise'),
  amount: z.coerce.number().positive('Montant requis'),
  notes: z.string().max(500).optional().or(z.literal('')),
});

export const updateVisitSchema = z.object({
  visitId: z.string().uuid('Visite invalide'),
  clientId: z.string().uuid('Client invalide'),
  visitedAt: z.string().min(1, 'Date requise'),
  amount: optionalAmount,
  notes: z.string().max(500).optional().or(z.literal('')),
});

export type RecordVisitInput = z.infer<typeof recordVisitSchema>;
export type RecordExpenseInput = z.infer<typeof recordExpenseSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
