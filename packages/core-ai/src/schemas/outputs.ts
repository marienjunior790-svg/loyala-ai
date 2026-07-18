import { z } from 'zod';

export const segmentSchema = z.object({
  segment: z.enum(['vip', 'regular', 'at_risk', 'new', 'dormant']),
  confidence: z.number().min(0).max(1),
  action: z.string().max(200),
  reason: z.string().max(300),
});

export const inactiveAnalysisSchema = z.object({
  urgency: z.enum(['low', 'medium', 'high']),
  winBackMessage: z.string().max(160),
  channel: z.enum(['whatsapp', 'sms', 'email']),
});

export const birthdayCampaignSchema = z.object({
  message: z.string().max(300),
  emoji: z.string().max(4),
  sendWindow: z.enum(['matin', 'midi', 'soir']),
});

export const loyaltyCampaignSchema = z.object({
  message: z.string().max(300),
  incentive: z.string().max(100),
  urgency: z.enum(['low', 'medium', 'high']),
});

export const affinityCampaignSchema = z.object({
  message: z.string().max(300),
  offer: z.string().max(100),
  urgency: z.enum(['low', 'medium', 'high']),
});

export const catalogGenerateItemSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(400).optional().default(''),
  price: z.coerce.number().min(0).default(0),
  type: z.enum(['product', 'service', 'rental']).default('product'),
});

export const catalogGenerateCategorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(300).optional().default(''),
  items: z.array(catalogGenerateItemSchema).max(60).default([]),
});

export const catalogGenerateSchema = z.object({
  currency: z.string().min(1).max(8).default('XOF'),
  categories: z.array(catalogGenerateCategorySchema).max(24).default([]),
});

// ─── Suggestion de variantes (IA) ────────────────────────────────────────────
export const variantSuggestChoiceSchema = z.object({
  label: z.string().min(1).max(80),
  priceDelta: z.coerce.number().default(0),
});

export const variantSuggestGroupSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z
    .enum([
      'size',
      'portion',
      'cooking',
      'flavor',
      'temperature',
      'spice',
      'supplement',
      'removable',
      'custom',
    ])
    .default('custom'),
  selection: z.enum(['single', 'multiple']).default('single'),
  required: z.boolean().default(false),
  choices: z.array(variantSuggestChoiceSchema).min(1).max(40),
});

export const variantSuggestSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        groups: z.array(variantSuggestGroupSchema).max(8).default([]),
      })
    )
    .max(60)
    .default([]),
});

export const catalogTranslateItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional().default(''),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(48),
        name: z.string().min(1).max(80),
        choices: z
          .array(
            z.object({
              id: z.string().min(1).max(48),
              label: z.string().min(1).max(80),
            })
          )
          .max(40)
          .default([]),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export const catalogTranslateSchema = z.object({
  locale: z.string().min(2).max(8),
  categories: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional().default(''),
      })
    )
    .max(40)
    .default([]),
  items: z.array(catalogTranslateItemSchema).max(80).default([]),
});

export const menuConsultCourseSchema = z.object({
  role: z.enum(['entree', 'plat', 'dessert', 'boisson', 'supplement', 'autre']).default('plat'),
  catalogItemName: z.string().min(1).max(160),
  label: z.string().max(160).optional().default(''),
  price: z.coerce.number().min(0).default(0),
});

export const menuConsultProposalSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  kind: z.string().max(40).default('jour'),
  courses: z.array(menuConsultCourseSchema).min(1).max(20),
  suggestedPrice: z.coerce.number().min(0).default(0),
  discountPercent: z.coerce.number().min(0).max(80).optional().default(0),
  estimatedCost: z.coerce.number().min(0).optional(),
  estimatedMargin: z.coerce.number().optional(),
  estimatedMarginPct: z.coerce.number().optional(),
  commercialAnalysis: z.string().max(800).default(''),
  confidence: z.coerce.number().min(0).max(100).default(70),
  confidenceReasons: z.array(z.string().max(160)).max(8).default([]),
});

export const menuConsultMarketingSchema = z.object({
  whatsapp: z.string().max(400).default(''),
  sms: z.string().max(160).default(''),
  emailSubject: z.string().max(120).default(''),
  emailBody: z.string().max(800).default(''),
  facebook: z.string().max(500).default(''),
  instagram: z.string().max(500).default(''),
  tiktok: z.string().max(500).default(''),
  linkedin: z.string().max(500).optional().default(''),
  hashtags: z.array(z.string().max(40)).max(12).default([]),
  posterPrompt: z.string().max(600).default(''),
});

export const menuConsultSchema = z.object({
  currency: z.string().min(1).max(8).default('XOF'),
  summary: z.string().max(500).default(''),
  contextInsights: z.array(z.string().max(200)).max(12).default([]),
  proposals: z.array(menuConsultProposalSchema).min(1).max(4),
  marketing: menuConsultMarketingSchema.optional(),
  catalogAdditions: z
    .array(
      z.object({
        category: z.string().max(120).default('Menus'),
        name: z.string().min(1).max(160),
        description: z.string().max(500).optional().default(''),
        price: z.coerce.number().min(0).default(0),
        type: z.enum(['product', 'service', 'rental']).default('product'),
      })
    )
    .max(10)
    .default([]),
});

export const promotionSuggestSchema = z.object({
  promotions: z.array(
    z.object({
      title: z.string().max(80),
      description: z.string().max(200),
      targetSegment: z.string().max(50),
      expectedLift: z.string().max(50),
    })
  ).max(5),
});

export const messageClassifySchema = z.object({
  intent: z.enum(['reservation', 'complaint', 'question', 'loyalty', 'spam', 'other']),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  priority: z.enum(['low', 'medium', 'high']),
  summary: z.string().max(80),
});

export const autoReplySchema = z.object({
  reply: z.string().max(400),
  tone: z.enum(['friendly', 'professional']),
  needsHumanReview: z.boolean(),
});

export type SegmentResult = z.infer<typeof segmentSchema>;
export type InactiveAnalysis = z.infer<typeof inactiveAnalysisSchema>;
export type BirthdayCampaign = z.infer<typeof birthdayCampaignSchema>;
export type LoyaltyCampaign = z.infer<typeof loyaltyCampaignSchema>;
export type AffinityCampaign = z.infer<typeof affinityCampaignSchema>;
export type CatalogGenerate = z.infer<typeof catalogGenerateSchema>;
export type CatalogGenerateCategory = z.infer<typeof catalogGenerateCategorySchema>;
export type CatalogGenerateItem = z.infer<typeof catalogGenerateItemSchema>;
export type MenuConsult = z.infer<typeof menuConsultSchema>;
export type MenuConsultProposal = z.infer<typeof menuConsultProposalSchema>;
export type PromotionSuggest = z.infer<typeof promotionSuggestSchema>;
export type VariantSuggest = z.infer<typeof variantSuggestSchema>;
export type VariantSuggestGroup = z.infer<typeof variantSuggestGroupSchema>;
export type CatalogTranslate = z.infer<typeof catalogTranslateSchema>;
export type MessageClassification = z.infer<typeof messageClassifySchema>;
export type AutoReply = z.infer<typeof autoReplySchema>;
