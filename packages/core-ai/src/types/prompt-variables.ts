import type { PromptKey } from './index';

/** Typed prompt variables — reduces token waste & runtime errors */
export interface SegmentVariables {
  clientId: string;
  fullName: string;
  rfmSegment: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
}

export interface ClassifyVariables {
  message: string;
  messageId: string;
}

export interface BirthdayVariables {
  clientName: string;
  restaurantName: string;
  offer: string;
}

export interface LoyaltyVariables {
  clientName: string;
  points: number;
  lastVisit: string;
}

export interface InactiveVariables {
  daysInactive: number;
  payload: string;
}

export interface ReplyVariables {
  message: string;
  context: string;
}

export interface PromotionVariables {
  payload: string;
}

export interface CrmSummaryVariables {
  data: string;
}

export type PromptVariablesMap = {
  'client.segment': SegmentVariables;
  'client.inactive.analyze': InactiveVariables;
  'campaign.birthday.generate': BirthdayVariables;
  'campaign.loyalty.generate': LoyaltyVariables;
  'campaign.promotion.suggest': PromotionVariables;
  'inbox.reply.generate': ReplyVariables;
  'inbox.message.classify': ClassifyVariables;
  crm_summary: CrmSummaryVariables;
  rfm_analysis: CrmSummaryVariables;
  support_reply: { message: string };
};

export type TypedPromptVariables<K extends keyof PromptVariablesMap> = PromptVariablesMap[K];

export function toPromptRecord<K extends keyof PromptVariablesMap>(
  vars: PromptVariablesMap[K]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
    out[k] = typeof v === 'number' ? String(v) : v;
  }
  if (!('payload' in out) && !('data' in out)) {
    out.payload = JSON.stringify(vars);
  }
  return out;
}

export function assertPromptKey(key: string): key is keyof PromptVariablesMap {
  const known: PromptKey[] = [
    'client.segment',
    'client.inactive.analyze',
    'campaign.birthday.generate',
    'campaign.loyalty.generate',
    'campaign.promotion.suggest',
    'inbox.reply.generate',
    'inbox.message.classify',
    'crm_summary',
    'rfm_analysis',
    'support_reply',
  ];
  return known.includes(key as PromptKey);
}
