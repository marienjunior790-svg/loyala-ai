import { z } from 'zod';

export const createClientSchema = z.object({
  fullName: z.string().min(2, 'Nom requis'),
  phone: z.string().min(8, 'Téléphone requis'),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide')
    .optional()
    .or(z.literal('')),
  optInWhatsapp: z.boolean().default(true),
  notes: z.string().optional(),
  acquisitionSource: z.string().max(64).optional().or(z.literal('')),
  whatsappProfileName: z.string().max(120).optional().or(z.literal('')),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
