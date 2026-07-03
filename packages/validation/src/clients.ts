import { z } from 'zod';

export const createClientSchema = z.object({
  fullName: z.string().min(2, 'Nom requis'),
  phone: z.string().min(8, 'Téléphone requis'),
  email: z.string().email().optional().or(z.literal('')),
  optInWhatsapp: z.boolean().default(true),
  notes: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
