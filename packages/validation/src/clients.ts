import { z } from 'zod';

export const whatsappConsentSchema = z.enum(['accorde', 'a_confirmer', 'refuse']);

/** Origine de l'accord : saisi en caisse, importé ou déduit d'un premier message entrant. */
export const whatsappConsentSourceSchema = z.enum(['formulaire', 'import', 'message_entrant']);

export const createClientSchema = z.object({
  fullName: z.string().min(2, 'Nom requis'),
  phone: z.string().min(8, 'Téléphone requis'),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide')
    .optional()
    .or(z.literal('')),
  optInWhatsapp: z.boolean().default(false),
  whatsappConsentSource: whatsappConsentSourceSchema.default('formulaire'),
  notes: z.string().optional(),
  acquisitionSource: z.string().max(64).optional().or(z.literal('')),
  whatsappProfileName: z.string().max(120).optional().or(z.literal('')),
});

export const updateClientSchema = createClientSchema.partial().extend({
  whatsappConsent: whatsappConsentSchema.optional(),
});

export type WhatsappConsent = z.infer<typeof whatsappConsentSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
