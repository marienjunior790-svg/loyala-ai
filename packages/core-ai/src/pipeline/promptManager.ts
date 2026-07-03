import type { AIUseCase, BuiltPrompt, PromptKey } from '../types';

export interface PromptTemplate {
  version: string;
  system: string;
  userTemplate: string;
  maxTokens: number;
  temperature: number;
  jsonMode: boolean;
}

const BASE_SYSTEM = `Tu es l'assistant IA de Loyala AI pour restaurants africains.
Règles: réponds en français, sois concis, n'invente jamais de données client.
Si une info manque, indique-le. Respecte le format demandé.`;

const TEMPLATES: Record<string, PromptTemplate> = {
  crm_summary: {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu résumes des données CRM.`,
    userTemplate: 'Résume ces données client de façon structurée:\n{{data}}',
    maxTokens: 300,
    temperature: 0.3,
    jsonMode: false,
  },
  rfm_analysis: {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu analyses la segmentation RFM.`,
    userTemplate: 'Analyse RFM à partir de:\n{{data}}',
    maxTokens: 250,
    temperature: 0.2,
    jsonMode: true,
  },
  support_reply: {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu rédiges des réponses support.`,
    userTemplate: 'Génère une réponse support pour:\n{{message}}',
    maxTokens: 300,
    temperature: 0.4,
    jsonMode: true,
  },
  'client.segment': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu segmentes des clients CRM selon scores RFM fournis.`,
    userTemplate: `Segmente ce client (JSON compact):
{{payload}}
Réponds UNIQUEMENT en JSON: {"segment":"vip|regular|at_risk|new|dormant","confidence":0-1,"action":"string courte","reason":"string"}`,
    maxTokens: 200,
    temperature: 0.2,
    jsonMode: true,
  },
  'client.inactive.analyze': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu analyses les clients inactifs pour relance.`,
    userTemplate: `Client inactif depuis {{daysInactive}} jours:
{{payload}}
JSON: {"urgency":"low|medium|high","winBackMessage":"max 160 chars","channel":"whatsapp|sms|email"}`,
    maxTokens: 250,
    temperature: 0.3,
    jsonMode: true,
  },
  'campaign.birthday.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu rédiges des messages anniversaire WhatsApp courts et chaleureux.`,
    userTemplate: `Restaurant: {{restaurantName}}
Client: {{clientName}}
Offre: {{offer}}
JSON: {"message":"max 300 chars","emoji":"1 emoji","sendWindow":"matin|midi|soir"}`,
    maxTokens: 200,
    temperature: 0.5,
    jsonMode: true,
  },
  'campaign.loyalty.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu crées des relances fidélité personnalisées.`,
    userTemplate: `Client: {{clientName}}, points: {{points}}, dernière visite: {{lastVisit}}
JSON: {"message":"max 300 chars","incentive":"string","urgency":"low|medium|high"}`,
    maxTokens: 220,
    temperature: 0.4,
    jsonMode: true,
  },
  'campaign.promotion.suggest': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu suggères des promotions data-driven pour restaurants.`,
    userTemplate: `Contexte restaurant:
{{payload}}
JSON: {"promotions":[{"title":"string","description":"string","targetSegment":"string","expectedLift":"string"}]}`,
    maxTokens: 400,
    temperature: 0.5,
    jsonMode: true,
  },
  'inbox.reply.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu rédiges des réponses client professionnelles et courtes.`,
    userTemplate: `Message client: {{message}}
Contexte: {{context}}
JSON: {"reply":"max 400 chars","tone":"friendly|professional","needsHumanReview":boolean}`,
    maxTokens: 300,
    temperature: 0.4,
    jsonMode: true,
  },
  'inbox.message.classify': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu classifies les messages entrants.`,
    userTemplate: `Message: {{message}}
JSON: {"intent":"reservation|complaint|question|loyalty|spam|other","sentiment":"positive|neutral|negative","priority":"low|medium|high","summary":"max 80 chars"}`,
    maxTokens: 180,
    temperature: 0.1,
    jsonMode: true,
  },
  'inbox.reply.suggest': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu suggères 2 brouillons de réponse.`,
    userTemplate: `Message: {{message}}
JSON: {"suggestions":["draft1","draft2"]}`,
    maxTokens: 350,
    temperature: 0.5,
    jsonMode: true,
  },
  'campaign.message.generate': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu génères des messages campagne WhatsApp.`,
    userTemplate: `Campagne: {{campaignType}}
Audience: {{audience}}
JSON: {"message":"max 500 chars","cta":"string"}`,
    maxTokens: 300,
    temperature: 0.5,
    jsonMode: true,
  },
  'review.response.suggest': {
    version: '1.0',
    system: `${BASE_SYSTEM} Tu rédiges des réponses aux avis Google.`,
    userTemplate: `Avis ({{rating}}/5): {{reviewText}}
JSON: {"response":"max 400 chars","tone":"grateful|apologetic|neutral"}`,
    maxTokens: 250,
    temperature: 0.4,
    jsonMode: true,
  },
};

function normalizeVariables(variables: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  if (!out.payload && !out.data) {
    out.payload = JSON.stringify(variables);
  }
  if (!out.data) out.data = out.payload ?? JSON.stringify(variables);
  return out;
}

export function buildPrompt(key: PromptKey, variables: Record<string, unknown>): BuiltPrompt {
  const template = TEMPLATES[key];
  if (!template) {
    throw new Error(`[core-ai] Unknown prompt key: ${key}`);
  }

  const vars = normalizeVariables(variables);
  let user = template.userTemplate;

  for (const [k, v] of Object.entries(vars)) {
    user = user.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }

  if (vars.payload && user.includes('{{payload}}')) {
    user = user.replace('{{payload}}', vars.payload);
  }

  return {
    system: template.system,
    user,
    maxTokens: template.maxTokens,
    temperature: template.temperature,
    jsonMode: template.jsonMode,
  };
}

/** @deprecated use buildPrompt — kept for engines */
export class PromptManager {
  buildPrompt(useCase: AIUseCase, variables: Record<string, string>): BuiltPrompt {
    return buildPrompt(useCase, variables);
  }
}

export const promptManager = new PromptManager();
