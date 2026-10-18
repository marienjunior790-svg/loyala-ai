import { z } from 'zod';

/** Corps de POST /api/mi/chat — Phase 1 L2 (pas de persistence). */
export const miChatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message requis')
    .max(2000, 'Message trop long (max 2000 caractères)'),
  locale: z.enum(['fr', 'en']).optional().default('fr'),
  /** Historique optionnel en mémoire UI uniquement — borné. */
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(10)
    .optional()
    .default([]),
  /** Période explicite ; sinon déduite du message. */
  period: z.enum(['semaine', 'mois', '3mois', 'annee']).optional(),
});

export type MiChatRequest = z.infer<typeof miChatRequestSchema>;

/** Query GET /api/mi/insights — cockpit P1 (lecture seule). */
export const miInsightsQuerySchema = z.object({
  period: z.enum(['semaine', 'mois', '3mois', 'annee']).optional().default('mois'),
});

export type MiInsightsQuery = z.infer<typeof miInsightsQuerySchema>;

export const MI_CHAT_MAX_ANSWER_CHARS = 4000;
