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
export type PromotionSuggest = z.infer<typeof promotionSuggestSchema>;
export type MessageClassification = z.infer<typeof messageClassifySchema>;
export type AutoReply = z.infer<typeof autoReplySchema>;
